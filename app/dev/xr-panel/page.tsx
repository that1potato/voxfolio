import { notFound } from "next/navigation";
import {
  loadList,
  loadListItem,
  loadPanel,
  markdownToBlocks,
  fmString,
} from "@/lib/content";
import { sections, type Section } from "@/site.config";
import type { ReadingArticle } from "@/components/menu/overlay-types";
import { XRPanelPreview } from "@/components/map/XRPanelPreview";

/**
 * Dev-only harness for the in-XR reading panel: mounts XRArticlePanel in a
 * plain (non-XR) Canvas so its layout, inline-markdown rendering, and
 * scrolling can be verified in a desktop browser without a headset.
 *
 * Usage: localhost:3000/dev/xr-panel?section=<section-id>&slug=<item-slug>
 *  - `section` is any id from site.config.ts `sections`. A panel section
 *    previews its /content/<id>.mdx; a list section previews `slug` from
 *    /content/<id>/, or its newest item when `slug` is omitted.
 *  - With no params: the first list section's newest item, else the first
 *    panel. If no content resolves, a built-in sample article that exercises
 *    every block type is shown instead.
 * Note: uikit only lets a mouse scroll by dragging the scrollbar — use the
 * scrollbar or DevTools touch emulation; XR rays drag the content directly.
 */
export default async function XRPanelDevPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; slug?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { section, slug } = await searchParams;
  const candidates = section
    ? sections.filter((s) => s.id === section)
    : [
        ...sections.filter((s) => s.kind === "list"),
        ...sections.filter((s) => s.kind === "panel"),
      ];

  let reading: ReadingArticle = SAMPLE_ARTICLE;
  for (const s of candidates) {
    const resolved = readSection(s, slug);
    if (resolved) {
      reading = resolved;
      break;
    }
  }

  return <XRPanelPreview content={reading} />;
}

/** One section's reading content, built the same way app/page.tsx builds it. */
function readSection(section: Section, slug?: string): ReadingArticle | null {
  if (section.kind === "panel") {
    const doc = loadPanel(section.id);
    if (!doc) return null;
    return {
      kind: "article",
      title: fmString(doc.frontmatter.title) ?? section.label,
      blocks: markdownToBlocks(doc.body),
    };
  }

  const doc = slug
    ? loadListItem(section.id, slug)
    : (loadList(section.id)[0] ?? null);
  if (!doc) return null;
  return {
    kind: "article",
    eyebrow: fmString(doc.frontmatter.category) ?? "Other",
    title: fmString(doc.frontmatter.title) ?? doc.slug,
    lede: fmString(doc.frontmatter.summary),
    blocks: markdownToBlocks(doc.body),
  };
}

// Self-contained image for the sample (no /public file needed): the voxel
// cube from app/icon.svg on the default light sky gradient, 16:9.
const SAMPLE_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'><defs><linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#aecadf'/><stop offset='0.52' stop-color='#d6e1e6'/><stop offset='1' stop-color='#f1e7d6'/></linearGradient></defs><rect width='640' height='360' fill='url(#sky)'/><g transform='translate(224 84) scale(6)' stroke='#4a3426' stroke-width='0.6' stroke-linejoin='miter'><polygon points='16,5 27,11 16,17 5,11' fill='#91b694'/><polygon points='5,11 16,17 16,26 5,20' fill='#956e56'/><polygon points='27,11 16,17 16,26 27,20' fill='#7a5a46'/></g></svg>",
  );

/**
 * Fallback fixture used when no content resolves. Covers every `ArticleBlock`
 * variant (headings 1-3, plain + styled paragraphs, bullet + numbered list
 * items, table, image, embed) and every `InlineSpan` flag.
 */
const SAMPLE_ARTICLE: ReadingArticle = {
  kind: "article",
  eyebrow: "Sample",
  title: "XR reading panel",
  lede: "Built-in fixture: add content under /content to preview your own.",
  blocks: [
    { type: "heading", level: 1, text: "Heading level 1" },
    {
      type: "paragraph",
      text: "A plain paragraph with no inline styling. It is long enough to wrap across several lines so line height, measure and paragraph spacing can be checked at the panel's real size.",
    },
    { type: "heading", level: 2, text: "Inline styles" },
    {
      type: "paragraph",
      text: "Mix bold, italic, bold italic, inline code and a link in one run.",
      spans: [
        { text: "Mix " },
        { text: "bold", bold: true },
        { text: ", " },
        { text: "italic", italic: true },
        { text: ", " },
        { text: "bold italic", bold: true, italic: true },
        { text: ", " },
        { text: "inline code", code: true },
        { text: " and " },
        { text: "a link", href: "https://example.com" },
        { text: " in one run." },
      ],
    },
    { type: "heading", level: 3, text: "Lists" },
    { type: "listItem", text: "A bullet item" },
    {
      type: "listItem",
      text: "A bullet item with bold text that runs long enough to wrap onto a second line",
      spans: [
        { text: "A bullet item with " },
        { text: "bold text", bold: true },
        { text: " that runs long enough to wrap onto a second line" },
      ],
    },
    { type: "listItem", text: "First numbered item", marker: "1." },
    {
      type: "listItem",
      text: "Second numbered item with code",
      spans: [
        { text: "Second numbered item with " },
        { text: "code", code: true },
      ],
      marker: "2.",
    },
    { type: "heading", level: 2, text: "Table" },
    {
      type: "table",
      header: [{ text: "Block" }, { text: "Source" }, { text: "Notes" }],
      rows: [
        [
          { text: "heading" },
          { text: "# / ## / ###", spans: [{ text: "# / ## / ###", code: true }] },
          { text: "Levels 1-3" },
        ],
        [
          { text: "image" },
          { text: "<Figure/> or ![alt](src)" },
          { text: "Optional caption", spans: [{ text: "Optional caption", italic: true }] },
        ],
        [
          { text: "embed" },
          { text: "<YouTube/>" },
          { text: "Poster card only in XR", spans: [{ text: "Poster card only in XR", bold: true }] },
        ],
      ],
    },
    { type: "heading", level: 2, text: "Media" },
    {
      type: "image",
      src: SAMPLE_IMAGE,
      alt: "A grass voxel cube on a pale sky gradient",
      caption: "An image block with a caption.",
    },
    {
      type: "embed",
      provider: "youtube",
      id: "aqz-KE-bpKQ",
      title: "Big Buck Bunny (Blender Foundation)",
    },
  ],
};
