import { EditorRoot } from "@/components/editor/EditorRoot";
import { loadMapData } from "@/lib/terrain-files";
import { fmString, loadList } from "@/lib/content";
import type { HoverItemRef } from "@/lib/editor-store";
import { sections } from "@/site.config";

export const dynamic = "force-dynamic";

export default function EditorPage() {
  // Every item of every list section can back a button hover card, keyed
  // "<sectionId>/<itemSlug>" (the same key the home page builds hoverCards with).
  const hoverItems: HoverItemRef[] = sections
    .filter((section) => section.kind === "list")
    .flatMap((section) =>
      loadList(section.id).map((doc) => ({
        id: `${section.id}/${doc.slug}`,
        label: `${section.label} › ${fmString(doc.frontmatter.title) ?? doc.slug}`,
      })),
    );

  return <EditorRoot initialMapData={loadMapData()} initialHoverItems={hoverItems} />;
}
