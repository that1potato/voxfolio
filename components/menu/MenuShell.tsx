"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { VoxelMap } from "@/components/map/VoxelMap";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { SectionOverlay } from "./SectionOverlay";
import { TerrainProvider } from "@/lib/terrain-context";
import { sections } from "@/site.config";
import type { MapData } from "@/lib/terrains";
import { siteTheme, type ThemePreference } from "@/theme.config";
import { useSystemTheme } from "@/lib/use-system-theme";
import { ArticleMasthead } from "@/components/article/ArticleMasthead";
import type {
  OverlayEntry,
  HoverCardMeta,
  ReadingContent,
} from "./overlay-types";

// Lazily loaded to stay out of the initial bundle; renders nothing on devices
// where navigator.xr doesn't report immersive support.
const EnterXRButton = dynamic(
  () => import("./EnterXRButton").then((m) => m.EnterXRButton),
  { ssr: false, loading: () => null },
);

interface Props {
  mapData: MapData;
  overlays: Record<string, OverlayEntry>;
  hoverCards?: Record<string, HoverCardMeta>;
}

/**
 * The top-level client shell for the home page. Composes the floating
 * voxel island, the corner controls (XR entry, theme switcher), and
 * owns the active-section state.
 */
export function MenuShell({ mapData, overlays, hoverCards }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [readingPanelBottomPx, setReadingPanelBottomPx] = useState<
    number | null
  >(null);
  // Active immersive session mode, lifted from VoxelMap. In XR the DOM reading
  // overlay can't composite, so we swap it for the in-scene panel.
  const [xrMode, setXrMode] = useState<XRSessionMode | null>(null);
  const inXR = xrMode !== null;
  // The switcher's pick; "system" resolves to the OS theme and follows it live.
  // Everything below receives the resolved light/dark `themeMode`.
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    siteTheme.defaultPreference,
  );
  const systemMode = useSystemTheme();
  const themeMode = themePreference === "system" ? systemMode : themePreference;
  const activeSection = active ? sections.find((s) => s.id === active) : null;
  const presentation = overlayOpen ? "reading" : "map";
  const overlayMounted = active !== null;

  const openSection = useCallback((sectionId: string, itemSlug?: string | null) => {
    // Ignore buttons pointing at a section that has no overlay (e.g. removed
    // from site.config.ts) instead of opening an empty panel.
    if (!overlays[sectionId]) return;
    setActive(sectionId);
    setActiveItem(itemSlug ?? null);
    setOverlayOpen(true);
  }, [overlays]);
  const closeSection = useCallback(() => setOverlayOpen(false), []);
  const clearSection = useCallback(() => {
    setActive(null);
    setActiveItem(null);
  }, []);

  // In XR the DOM overlay (whose exit animation normally fires clearSection via
  // onExitComplete) is unmounted, so a close from the in-scene panel would leave
  // `active` set forever — keeping interactionDisabled on and every island
  // button dead. Clear immediately: there is no exit animation to wait for.
  useEffect(() => {
    if (inXR && !overlayOpen && active !== null) clearSection();
  }, [inXR, overlayOpen, active, clearSection]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.siteTheme = themeMode;
    root.style.colorScheme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    return () => {
      root.dataset.siteTheme = siteTheme.activeMode;
      root.style.colorScheme = siteTheme.activeMode;
    };
  }, []);

  // Derive the overlay content node and header title.
  const entry = active ? overlays[active] : null;

  let currentItem = null;
  if (entry?.kind === "list" && activeItem) {
    for (const group of entry.groups) {
      const found = group.items.find((it) => it.slug === activeItem);
      if (found) { currentItem = found; break; }
    }
  }

  const inItem = Boolean(currentItem);
  const overlayTitle = currentItem
    ? currentItem.title
    : entry?.kind === "panel"
      ? entry.title
      : (activeSection?.label ?? "");

  let overlayContent: ReactNode = null;
  if (entry?.kind === "panel") {
    overlayContent = entry.content;
  } else if (entry?.kind === "list") {
    if (inItem && currentItem) {
      overlayContent = currentItem.content;
    } else if (entry.groups.length === 0) {
      overlayContent = (
        <div className="article-doc article-doc--wide">
          <ArticleMasthead title={activeSection?.label ?? ""} />
          <p className="article-muted">
            Add <code>.mdx</code> files to <code>/content/{active}/</code>.
          </p>
        </div>
      );
    } else {
      overlayContent = (
        <div className="article-doc article-doc--wide space-y-6">
          <ArticleMasthead title={activeSection?.label ?? ""} />
          {entry.groups.map((group) => (
            <div key={group.category}>
              <h3 className="article-group-heading">{group.category}</h3>
              <ul className="article-list">
                {group.items.map((it) => (
                  <li key={it.slug}>
                    <button
                      type="button"
                      className="article-card"
                      onClick={() => setActiveItem(it.slug)}
                    >
                      <div className="article-card-title">{it.title}</div>
                      {it.summary && (
                        <div className="article-card-summary">{it.summary}</div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    }
  }

  // Plain-data mirror of the overlay content for the in-scene XR reading panel.
  const activeReadingContent: ReadingContent | null = currentItem
    ? currentItem.reading
    : entry?.kind === "panel"
      ? entry.reading
      : entry?.kind === "list"
        ? {
            kind: "list",
            title: overlayTitle,
            groups: entry.groups.map((group) => ({
              category: group.category,
              items: group.items.map((it) => ({
                slug: it.slug,
                title: it.title,
                summary: it.summary,
              })),
            })),
          }
        : null;

  return (
    <TerrainProvider mapData={mapData}>
      <VoxelMap
        mode={presentation}
        themeMode={themeMode}
        interactionDisabled={overlayMounted}
        activeSectionId={overlayOpen ? active : null}
        onSelectSection={openSection}
        readingContent={overlayOpen ? activeReadingContent : null}
        onCloseSection={closeSection}
        onSelectReadingItem={setActiveItem}
        onReadingBack={inItem ? () => setActiveItem(null) : undefined}
        onXRModeChange={setXrMode}
        hoverCards={hoverCards}
        readingPanelBottomPx={readingPanelBottomPx}
      />

      {/* Always mounted so it can fade/slide in and out with the overlay,
          mirroring the article panel's enter/leave animation. */}
      <div className="fixed right-6 top-6 z-30 flex flex-col items-end gap-3 md:right-10 md:top-10">
        <EnterXRButton hidden={overlayOpen} />
        <ThemeSwitcher
          themePreference={themePreference}
          onThemePreferenceChange={setThemePreference}
          hidden={overlayOpen}
        />
      </div>

      {/* DOM reading surface for the flat/desktop view. In an immersive session
          it can't composite, so the in-scene XRArticlePanel (mounted by VoxelMap)
          takes over; exiting XR re-mounts this with the same state. */}
      {!inXR && (
        <SectionOverlay
          open={overlayOpen && overlayMounted}
          title={overlayTitle}
          themeMode={themeMode}
          onClose={closeSection}
          onExitComplete={clearSection}
          onBack={inItem ? () => setActiveItem(null) : undefined}
          onPanelBottomChange={setReadingPanelBottomPx}
        >
          {overlayContent}
        </SectionOverlay>
      )}
    </TerrainProvider>
  );
}
