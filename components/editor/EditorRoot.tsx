"use client";

import { useEffect, useState } from "react";
import {
  hasUnsavedChanges,
  useEditorStore,
  type HoverItemRef,
} from "@/lib/editor-store";
import type { MapData } from "@/lib/terrains";
import { TerrainToolbar } from "./TerrainToolbar";
import { BlockTypePanel } from "./BlockTypePanel";
import { EditorPreview } from "./EditorPreview";
import { TilePainter } from "./TilePainter";
import { ElementList } from "./ElementList";
import { ElementForm } from "./ElementForm";
import { UnsavedTerrainDialog } from "./UnsavedTerrainDialog";
import { siteTheme, type SiteThemeMode } from "@/theme.config";

export function EditorRoot({
  initialMapData,
  initialHoverItems = [],
}: {
  initialMapData: MapData;
  initialHoverItems?: HoverItemRef[];
}) {
  const [themeMode, setThemeMode] = useState<SiteThemeMode>(
    siteTheme.activeMode,
  );
  const initialized = useEditorStore((state) => state.initialized);
  const initialize = useEditorStore((state) => state.initialize);
  const setAvailableHoverItems = useEditorStore(
    (state) => state.setAvailableHoverItems,
  );
  const doc = useEditorStore((s) => s.doc);
  const activeTerrainId = useEditorStore((s) => s.activeTerrainId);
  const activeTerrain = doc.terrains.find((t) => t.id === activeTerrainId);
  const hasUnsaved = useEditorStore(hasUnsavedChanges);

  useEffect(() => {
    initialize(initialMapData);
  }, [initialMapData, initialize]);

  useEffect(() => {
    setAvailableHoverItems(initialHoverItems);
  }, [initialHoverItems, setAvailableHoverItems]);

  useEffect(() => {
    if (!hasUnsaved) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsaved]);

  if (!initialized) {
    return <div className="p-6 font-block text-sm uppercase text-cream/60">Loading editor…</div>;
  }

  return (
    <div className="flex h-screen flex-col">
      <TerrainToolbar />
      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-cream/20 bg-brownDark p-4">
          <h2 className="mb-2 font-block text-xs uppercase tracking-widest text-cream/60">
            Terrain
          </h2>
          {activeTerrain ? (
            <div className="space-y-4">
              <div className="text-cream">
                <div className="font-block text-sm uppercase">{activeTerrain.label}</div>
                <div className="text-xs text-cream/60">
                  {activeTerrain.grid.width}×{activeTerrain.grid.depth} cells • origin (
                  {activeTerrain.grid.originX}, {activeTerrain.grid.originZ})
                </div>
              </div>
              <BlockTypePanel themeMode={themeMode} />
              <TilePainter themeMode={themeMode} />
            </div>
          ) : (
            <p className="text-cream/40">No terrain selected.</p>
          )}
        </aside>

        <main className="relative flex-1 min-w-0 bg-[#0e0a08]">
          <EditorPreview
            themeMode={themeMode}
            onThemeModeChange={setThemeMode}
          />
        </main>

        <aside className="w-80 shrink-0 overflow-y-auto border-l border-cream/20 bg-brownDark p-4">
          <h2 className="mb-2 font-block text-xs uppercase tracking-widest text-cream/60">
            Elements
          </h2>
          <ElementList />
          <ElementForm />
        </aside>
      </div>
      <UnsavedTerrainDialog />
    </div>
  );
}
