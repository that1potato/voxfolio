"use client";

import { useEditorStore } from "@/lib/editor-store";
import { resolveThemeColor } from "@/lib/theme-colors";
import type { SiteThemeMode } from "@/theme.config";

interface Props {
  themeMode: SiteThemeMode;
  onThemeModeChange: (mode: SiteThemeMode) => void;
  showBuildElements: boolean;
  onShowBuildElementsChange: (value: boolean) => void;
  showSurroundings: boolean;
  onShowSurroundingsChange: (value: boolean) => void;
}

export function EditorViewportToolbar({
  themeMode,
  onThemeModeChange,
  showBuildElements,
  onShowBuildElementsChange,
  showSurroundings,
  onShowSurroundingsChange,
}: Props) {
  const blockTypes = useEditorStore((state) => state.blockTypes);
  const activeBlockTypeId = useEditorStore((state) => state.activeBlockTypeId);
  const buildEnabled = useEditorStore((state) => state.buildEnabled);
  const buildMode = useEditorStore((state) => state.buildMode);
  const setBuildEnabled = useEditorStore((state) => state.setBuildEnabled);
  const setBuildMode = useEditorStore((state) => state.setBuildMode);
  const resetCameraView = useEditorStore((state) => state.resetCameraView);
  const testMode = useEditorStore((state) => state.testMode);
  const activeBlockType =
    blockTypes.blockTypes.find((blockType) => blockType.id === activeBlockTypeId) ??
    blockTypes.blockTypes[0];

  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-20 w-max max-w-[calc(100%-2rem)] -translate-x-1/2">
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 border border-cream/25 bg-charcoal/95 px-3 py-2 shadow-lg backdrop-blur-sm">
        <span className="font-block text-[10px] uppercase tracking-widest text-cream/60">
          Build
        </span>
        <button
          type="button"
          aria-pressed={buildEnabled}
          onClick={() => setBuildEnabled(!buildEnabled)}
          className={`px-2 py-1 font-block text-[10px] uppercase ${
            buildEnabled
              ? "bg-yellow-400 text-charcoal"
              : "border border-cream/30 text-cream hover:bg-cream/10"
          }`}
        >
          {buildEnabled ? "On" : "Off"}
        </button>
        <button
          type="button"
          onClick={() => setBuildMode("add")}
          disabled={!buildEnabled}
          className={`px-2 py-1 font-block text-[10px] uppercase ${
            buildMode === "add" && buildEnabled
              ? "bg-cream text-charcoal"
              : "border border-cream/30 text-cream hover:bg-cream/10"
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => setBuildMode("delete")}
          disabled={!buildEnabled}
          className={`px-2 py-1 font-block text-[10px] uppercase ${
            buildMode === "delete" && buildEnabled
              ? "bg-red-500 text-white"
              : "border border-cream/30 text-cream hover:bg-cream/10"
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Delete
        </button>
        {buildEnabled && (
          <button
            type="button"
            aria-pressed={showBuildElements}
            onClick={() => onShowBuildElementsChange(!showBuildElements)}
            className={`px-2 py-1 font-block text-[10px] uppercase ${
              showBuildElements
                ? "bg-cream text-charcoal"
                : "border border-cream/30 text-cream hover:bg-cream/10"
            }`}
          >
            Elements {showBuildElements ? "On" : "Off"}
          </button>
        )}
        {activeBlockType && (
          <span className="flex items-center gap-1.5 border-l border-cream/20 pl-2 text-[10px] text-cream/75">
            <span
              className="h-3.5 w-3.5 border border-cream/30"
              style={{
                backgroundColor: resolveThemeColor(
                  activeBlockType.appearance,
                  themeMode,
                ),
              }}
            />
            <span className="font-block uppercase">{activeBlockType.label}</span>
          </span>
        )}
        <span className="border-l border-cream/20 pl-2 font-block text-[10px] uppercase tracking-widest text-cream/60">
          Surroundings
        </span>
        <button
          type="button"
          aria-pressed={showSurroundings}
          onClick={() => onShowSurroundingsChange(!showSurroundings)}
          className={`px-2 py-1 font-block text-[10px] uppercase ${
            showSurroundings
              ? "bg-cream text-charcoal"
              : "border border-cream/30 text-cream hover:bg-cream/10"
          }`}
        >
          {showSurroundings ? "On" : "Off"}
        </button>
        <span className="border-l border-cream/20 pl-2 font-block text-[10px] uppercase tracking-widest text-cream/60">
          Preview
        </span>
        {(["light", "dark"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={themeMode === mode}
            onClick={() => onThemeModeChange(mode)}
            className={`px-2 py-1 font-block text-[10px] uppercase ${
              themeMode === mode
                ? "bg-cream text-charcoal"
                : "border border-cream/30 text-cream hover:bg-cream/10"
            }`}
          >
            {mode}
          </button>
        ))}
        <button
          type="button"
          onClick={resetCameraView}
          className="border border-cream/30 px-2 py-1 font-block text-[10px] uppercase text-cream hover:bg-cream/10"
        >
          Reset View
        </button>
      </div>
      <div className="mt-1 text-center font-mono text-[10px] text-cream/60">
        {testMode
          ? "Test mode · buttons navigate · right-drag orbit · middle-drag pan · scroll zoom"
          : buildEnabled
            ? `${buildMode === "add" ? "Add" : "Delete"} mode · left-click blocks · right-drag orbit · middle-drag pan · scroll zoom`
            : "Select mode · click elements · right-drag orbit · middle-drag pan · scroll zoom"}
      </div>
    </div>
  );
}
