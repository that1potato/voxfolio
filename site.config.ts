/**
 * Site identity + content registry.
 *
 *  - Edit `site` to change the site name and description (page <title>,
 *    meta description and PWA manifest).
 *  - Edit `sections` to add or remove an MDX content section.
 *  - Edit `palette` to retune the shared UI colors (Tailwind reads it directly).
 *
 * NOTE: Map visuals live in /data/terrains/, while paintable block definitions
 * live in /data/block-types.json. Both are authored via the /editor tool.
 */

export type SectionKind = "panel" | "list";

export interface Section {
  /** Unique URL-safe id. Becomes the content folder/file name and links a button's contentSectionId. */
  id: string;
  /** Display label used as the overlay header. */
  label: string;
  /**
   * "panel" = single .mdx, "list" = folder of .mdx (e.g. projects, blog).
   * List items also feed button hover cards, keyed "<id>/<item-slug>".
   */
  kind: SectionKind;
}

// Document metadata only. The 3D island title is a terrain `title` element,
// authored in /data/terrains/ (or the /editor), not this name.
export const site = {
  name: "Voxfolio",
  description: "A 3D voxel island site, built with voxfolio.",
};

export const sections: Section[] = [
  { id: "about",    label: "ABOUT",    kind: "panel" },
  { id: "projects", label: "PROJECTS", kind: "list"  },
];

// Shared UI colors: the site chrome (editor + reading surface) plus the
// default colors for 3D elements/voxel text. Per-terrain and per-block colors
// are authored in /data, not here. Exposed to Tailwind via tailwind.config.ts.
export const palette = {
  brown: "#6b4a36", // editor toolbar surface; legacy Voxel default
  brownDark: "#553a29", // 3D nav-button face; panels & dialogs
  cream: "#f5f1e6", // primary parchment foreground; default voxel-text color
  charcoal: "#1a1410", // near-black backgrounds + the pixel-text outline
};
