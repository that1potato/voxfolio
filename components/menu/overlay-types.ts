import type { ReactNode } from "react";

/**
 * Plain-data (JSON-serializable) representation of a section's reading content,
 * a sibling of the server-rendered `content: ReactNode`. The React tree is RSC
 * MDX and can't re-render inside the client <Canvas>, so the in-scene XR reading
 * panel (components/map/XRArticlePanel.tsx) draws from this instead.
 */
/** One run of inline text with optional styling flags (parsed from inline
 *  markdown: bold / italic / `code` / [links](…)). `href` is visual-only in
 *  XR — opening a browser tab would suspend the immersive session. */
export interface InlineSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  href?: string;
}

export interface TableCell {
  text: string;
  spans?: InlineSpan[];
}

export type ArticleBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string; spans?: InlineSpan[] }
  | { type: "listItem"; text: string; spans?: InlineSpan[]; marker?: string }
  | { type: "image"; src: string; alt: string; caption?: string }
  | { type: "table"; header: TableCell[]; rows: TableCell[][] }
  | { type: "embed"; provider: "youtube"; id: string; title?: string };

export interface ReadingArticle {
  kind: "article";
  /** Item category (frontmatter `category`), shown as an eyebrow above the title. */
  eyebrow?: string;
  title: string;
  /** Item summary (frontmatter `summary`), shown as a lede under the title. */
  lede?: string;
  blocks: ArticleBlock[];
}

export interface ReadingList {
  kind: "list";
  title: string;
  groups: {
    category: string;
    items: { slug: string; title: string; summary: string | null }[];
  }[];
}

export type ReadingContent = ReadingArticle | ReadingList;

export interface OverlayListItem {
  slug: string;
  title: string;
  summary: string | null;
  content: ReactNode;
  /** Plain-data form of `content` for the in-scene XR reading panel. */
  reading: ReadingArticle;
}

export interface OverlayListGroup {
  category: string;
  items: OverlayListItem[];
}

export type OverlayEntry =
  | { kind: "panel"; title: string; content: ReactNode; reading: ReadingArticle }
  | { kind: "list"; groups: OverlayListGroup[] };

/**
 * List-item metadata shown in a button's 3D hover card. The `hoverCards` map
 * is keyed by `"<sectionId>/<itemSlug>"` (a button's `hoverCardItem`).
 */
export interface HoverCardMeta {
  category: string | null;
  summary: string | null;
  tech?: string[];
}
