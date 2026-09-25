import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type {
  ArticleBlock,
  InlineSpan,
  TableCell,
} from "@/components/menu/overlay-types";

const CONTENT_DIR = path.join(process.cwd(), "content");

export interface ContentDoc {
  slug: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

/** Read a single .mdx file at /content/<id>.mdx */
export function loadPanel(id: string): ContentDoc | null {
  const file = path.join(CONTENT_DIR, `${id}.mdx`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  const parsed = matter(raw);
  return { slug: id, frontmatter: parsed.data, body: parsed.content };
}

/** Read all .mdx files in /content/<id>/ as a list, newest-first by frontmatter.date. */
export function loadList(id: string): ContentDoc[] {
  const dir = path.join(CONTENT_DIR, id);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      const parsed = matter(raw);
      return {
        slug: f.replace(/\.mdx$/, ""),
        frontmatter: parsed.data,
        body: parsed.content,
      };
    })
    .sort((a, b) => {
      // Compare normalized ISO dates: gray-matter parses unquoted YAML dates
      // into Date objects, whose String() form starts with the weekday.
      const da = fmDate(a.frontmatter.date) ?? "";
      const db = fmDate(b.frontmatter.date) ?? "";
      return db.localeCompare(da);
    });
}

/** Narrow a frontmatter value to a string, or undefined. */
export function fmString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Normalize a frontmatter date to an ISO `YYYY-MM-DD` string. Unquoted YAML
 * dates (e.g. `date: 2025-02-20`) are parsed as Date objects by gray-matter, so
 * accept both Date and string here.
 */
export function fmDate(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

/** Narrow a frontmatter value to a string[], dropping non-strings. */
export function fmStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((v): v is string => typeof v === "string");
  return items.length ? items : undefined;
}

/** Read a single list item at /content/<id>/<slug>.mdx */
export function loadListItem(id: string, slug: string): ContentDoc | null {
  const file = path.join(CONTENT_DIR, id, `${slug}.mdx`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  const parsed = matter(raw);
  return { slug, frontmatter: parsed.data, body: parsed.content };
}

/** Flatten inline markdown (links, emphasis, code) to plain prose. */
function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [label](url) -> label
    .replace(/[*_`~]/g, "") // emphasis / code marks
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse inline markdown (`code`, [links](url), **bold**, *italic*) into styled
 * spans for the XR reading panel. Returns `spans` only when the source actually
 * carries styling, so unstyled text keeps the cheap single-string path.
 */
export function parseInline(source: string): {
  text: string;
  spans?: InlineSpan[];
} {
  const input = source.replace(/\s+/g, " ").trim();
  const spans: InlineSpan[] = [];
  let buf = "";
  let bold = false;
  let italic = false;
  let styled = false;

  const flush = () => {
    if (!buf) return;
    const last = spans[spans.length - 1];
    // Merge with the previous span when the style is identical (keeps span
    // count low and word-splitting in the renderer natural).
    if (last && !last.code && !last.href && !!last.bold === bold && !!last.italic === italic) {
      last.text += buf;
    } else {
      spans.push({
        text: buf,
        ...(bold ? { bold: true } : {}),
        ...(italic ? { italic: true } : {}),
      });
    }
    buf = "";
  };

  const isWordChar = (ch: string | undefined) =>
    ch !== undefined && /[\w]/.test(ch);

  let i = 0;
  while (i < input.length) {
    // Inline code: no nesting inside.
    if (input[i] === "`") {
      const end = input.indexOf("`", i + 1);
      if (end > i) {
        flush();
        spans.push({ text: input.slice(i + 1, end), code: true });
        styled = true;
        i = end + 1;
        continue;
      }
    }
    // Link: [label](url) — label keeps current bold/italic, marks stripped.
    const link = /^\[([^\]]+)\]\(([^)\s]+)[^)]*\)/.exec(input.slice(i));
    if (link) {
      flush();
      spans.push({
        text: link[1].replace(/[*_`~]/g, ""),
        href: link[2],
        ...(bold ? { bold: true } : {}),
        ...(italic ? { italic: true } : {}),
      });
      styled = true;
      i += link[0].length;
      continue;
    }
    // Bold: ** or __
    if (input.startsWith("**", i) || input.startsWith("__", i)) {
      flush();
      bold = !bold;
      styled = true;
      i += 2;
      continue;
    }
    // Italic: * or _ — word-boundary guard so snake_case / 2*3 pass through.
    if (input[i] === "*" || input[i] === "_") {
      const prev = input[i - 1];
      const next = input[i + 1];
      const opens = !italic && !isWordChar(prev) && next !== undefined && next !== " ";
      const closes = italic && prev !== undefined && prev !== " " && !isWordChar(next);
      if (opens || closes) {
        flush();
        italic = !italic;
        styled = true;
        i += 1;
        continue;
      }
    }
    buf += input[i];
    i += 1;
  }
  flush();

  const text = spans
    .map((s) => s.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (!styled) return { text };
  return { text, spans };
}

/** `parseInline` narrowed to a table cell. */
function parseCell(source: string): TableCell {
  const { text, spans } = parseInline(source);
  return spans ? { text, spans } : { text };
}

/** Split a `| a | b |` table row into trimmed cell strings. */
function splitTableRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/**
 * Flatten an MDX body into ordered plain-data blocks for the in-scene XR reading
 * panel, which lays them out with @react-three/uikit (no HTML/MDX available
 * inside the WebGL scene). A light line-based pass: blank lines separate blocks,
 * `#`/`##`/`###` become headings, `-`/`*`/`1.` become list items (numbered ones
 * keep their marker), GFM tables become table blocks, `<Figure/>` tags and
 * `![alt](src)` become image blocks, `<YouTube/>` becomes an embed card, other
 * JSX tags are dropped, and everything else is a paragraph. Inline markdown
 * (bold/italic/code/links) is carried as styled spans. Limitation: fenced code
 * blocks are dropped in XR (the DOM overlay still renders them via MDX).
 */
export function markdownToBlocks(body: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  const paragraph: string[] = [];
  let inFence = false;
  // Non-null while accumulating a JSX tag that spans multiple source lines.
  let jsxBuffer: string | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const { text, spans } = parseInline(paragraph.join(" "));
    if (text) blocks.push({ type: "paragraph", text, ...(spans ? { spans } : {}) });
    paragraph.length = 0;
  };

  // A complete JSX tag: <Figure/> becomes an image block, <YouTube/> a visual
  // embed card, anything else is dropped (the reading panel has no renderer
  // for arbitrary components).
  const flushJsx = (tag: string) => {
    const attr = (name: string) =>
      new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];
    if (/^<Figure\b/.test(tag)) {
      const src = attr("src");
      if (!src) return;
      const caption = attr("caption");
      blocks.push({
        type: "image",
        src,
        alt: attr("alt") ?? "",
        ...(caption ? { caption } : {}),
      });
      return;
    }
    if (/^<YouTube\b/.test(tag)) {
      const id = attr("id");
      if (!id) return;
      const title = attr("title");
      blocks.push({
        type: "embed",
        provider: "youtube",
        id,
        ...(title ? { title } : {}),
      });
    }
  };

  const lines = body.split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim();

    if (jsxBuffer !== null) {
      jsxBuffer += ` ${line}`;
      if (/>$/.test(line)) {
        flushJsx(jsxBuffer);
        jsxBuffer = null;
      }
      continue;
    }

    // Toggle fenced code blocks and skip their contents entirely.
    if (line.startsWith("```")) {
      flushParagraph();
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (line === "") {
      flushParagraph();
      continue;
    }

    // JSX/HTML tag lines: capture <Figure/> images, drop everything else.
    if (/^<[A-Za-z/!]/.test(line)) {
      flushParagraph();
      if (/>$/.test(line)) flushJsx(line);
      else jsxBuffer = line;
      continue;
    }

    // Markdown image on its own line.
    const mdImage = /^!\[([^\]]*)\]\(([^)\s]+)[^)]*\)$/.exec(line);
    if (mdImage) {
      flushParagraph();
      blocks.push({ type: "image", src: mdImage[2], alt: mdImage[1] });
      continue;
    }

    // GFM table: a `| … |` row followed by a `| --- | --- |` separator line.
    if (
      line.startsWith("|") &&
      /^\|?[\s:|-]+\|?$/.test(lines[lineIndex + 1]?.trim() ?? "") &&
      (lines[lineIndex + 1]?.includes("-") ?? false)
    ) {
      flushParagraph();
      const header = splitTableRow(line).map(parseCell);
      const rows: TableCell[][] = [];
      let rowIndex = lineIndex + 2; // skip the separator line
      while (rowIndex < lines.length && lines[rowIndex].trim().startsWith("|")) {
        rows.push(splitTableRow(lines[rowIndex].trim()).map(parseCell));
        rowIndex++;
      }
      blocks.push({ type: "table", header, rows });
      lineIndex = rowIndex - 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: stripMarkdown(heading[2]),
      });
      continue;
    }

    const listItem = /^([-*+]|\d+\.)\s+(.*)$/.exec(line);
    if (listItem) {
      flushParagraph();
      const { text, spans } = parseInline(listItem[2]);
      if (text) {
        // Numbered items keep their marker; dashes/asterisks render as bullets.
        const marker = /^\d+\.$/.test(listItem[1]) ? listItem[1] : undefined;
        blocks.push({
          type: "listItem",
          text,
          ...(spans ? { spans } : {}),
          ...(marker ? { marker } : {}),
        });
      }
      continue;
    }

    paragraph.push(line);
  }
  flushParagraph();

  return blocks;
}
