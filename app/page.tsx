import { MenuShell } from "@/components/menu/MenuShell";
import { MdxBody } from "@/components/mdx/MdxBody";
import { ArticleMasthead } from "@/components/article/ArticleMasthead";
import { sections } from "@/site.config";
import {
  loadPanel,
  loadList,
  fmString,
  fmStringArray,
  markdownToBlocks,
} from "@/lib/content";
import { loadMapData } from "@/lib/terrain-files";
import type {
  OverlayEntry,
  OverlayListItem,
  OverlayListGroup,
  HoverCardMeta,
} from "@/components/menu/overlay-types";

/**
 * Home page = the game's main-menu screen.
 *
 * Server-renders every section's content up front, then hands those
 * React trees to the client <MenuShell/> which manages which one is
 * currently displayed in the overlay. Terrain layout is loaded from
 * /data/terrains/ and /data/block-types.json (edit via /editor).
 */
export default function Home() {
  const mapData = loadMapData();
  const overlays: Record<string, OverlayEntry> = {};
  // List-item metadata for button hover cards, keyed "<sectionId>/<itemSlug>"
  // (a button's `hoverCardItem`). Built for every list section.
  const hoverCards: Record<string, HoverCardMeta> = {};

  for (const s of sections) {
    if (s.kind === "panel") {
      const doc = loadPanel(s.id);
      // The .mdx frontmatter `title` is the source of truth for the heading;
      // fall back to the section's registry label if it's absent.
      const heading = fmString(doc?.frontmatter.title) ?? s.label;
      overlays[s.id] = {
        kind: "panel",
        title: heading,
        content: (
          <div className="article-doc">
            <ArticleMasthead title={heading} />
            {doc ? (
              <MdxBody source={doc.body} />
            ) : (
              <p className="article-muted">
                Add <code>/content/{s.id}.mdx</code> to fill this section.
              </p>
            )}
          </div>
        ),
        reading: {
          kind: "article",
          title: heading,
          blocks: doc ? markdownToBlocks(doc.body) : [],
        },
      };
    } else {
      const docs = loadList(s.id);

      // Group by frontmatter.category; items without one go into "Other" (pushed to end).
      const groupMap = new Map<string, OverlayListItem[]>();
      for (const it of docs) {
        const title = fmString(it.frontmatter.title) ?? it.slug;
        const summary = fmString(it.frontmatter.summary) ?? null;
        const itemCategory = fmString(it.frontmatter.category);
        const category = itemCategory ?? "Other";

        const tech = fmStringArray(it.frontmatter.tech);
        const repo = fmString(it.frontmatter.repo);
        const demo = fmString(it.frontmatter.demo);

        hoverCards[`${s.id}/${it.slug}`] = {
          category: itemCategory ?? null,
          summary,
          tech,
        };

        if (!groupMap.has(category)) groupMap.set(category, []);
        groupMap.get(category)!.push({
          slug: it.slug,
          title,
          summary,
          content: (
            <div className="article-doc">
              <ArticleMasthead
                eyebrow={category}
                title={title}
                lede={summary ?? undefined}
                tech={tech}
                repo={repo}
                demo={demo}
              />
              <MdxBody source={it.body} />
            </div>
          ),
          reading: {
            kind: "article",
            eyebrow: category,
            title,
            lede: summary ?? undefined,
            blocks: markdownToBlocks(it.body),
          },
        });
      }

      const groups: OverlayListGroup[] = Array.from(groupMap.entries())
        .sort(([categoryA], [categoryB]) => {
          if (categoryA === "Other") return 1;
          if (categoryB === "Other") return -1;
          return categoryA.localeCompare(categoryB);
        })
        .map(([category, items]) => ({ category, items }));

      overlays[s.id] = { kind: "list", groups };
    }
  }

  return <MenuShell mapData={mapData} overlays={overlays} hoverCards={hoverCards} />;
}
