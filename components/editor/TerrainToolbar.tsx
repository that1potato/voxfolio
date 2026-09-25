"use client";

import { useEffect, useState } from "react";
import {
  getTerrainEditorStatus,
  hasUnsavedChanges,
  useEditorStore,
} from "@/lib/editor-store";
import {
  TERRAIN_ID_PATTERN,
  validateTerrain,
  validateTerrainId,
} from "@/lib/terrains";
import { atmospheres, getAtmosphere } from "@/atmosphere.config";

export function TerrainToolbar() {
  const doc = useEditorStore((state) => state.doc);
  const blockTypes = useEditorStore((state) => state.blockTypes);
  const activeTerrainId = useEditorStore((state) => state.activeTerrainId);
  const requestTerrainSwitch = useEditorStore((state) => state.requestTerrainSwitch);
  const saveChanges = useEditorStore((state) => state.saveChanges);
  const generateSurroundings = useEditorStore((state) => state.generateSurroundings);
  const revertChanges = useEditorStore((state) => state.revertChanges);
  const importTerrain = useEditorStore((state) => state.importTerrain);
  const addTerrain = useEditorStore((state) => state.addTerrain);
  const deleteTerrain = useEditorStore((state) => state.deleteTerrain);
  const setTerrainAtmosphere = useEditorStore((state) => state.setTerrainAtmosphere);
  const testMode = useEditorStore((state) => state.testMode);
  const setTestMode = useEditorStore((state) => state.setTestMode);
  const hasUnsaved = useEditorStore(hasUnsavedChanges);
  const saving = useEditorStore((state) => state.saving);
  const activeError = useEditorStore((state) => state.saveError);
  const terrainStatus = useEditorStore((state) =>
    getTerrainEditorStatus(state, state.activeTerrainId),
  );
  const status =
    saving
      ? "saving"
      : activeError
        ? "error"
        : terrainStatus === "new"
          ? "new"
          : hasUnsaved
            ? "dirty"
            : "clean";
  const activeTerrain = doc.terrains.find((terrain) => terrain.id === activeTerrainId);
  const activeAtmosphere = activeTerrain?.atmosphere;
  const [importValue, setImportValue] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const diskWritesEnabled = process.env.NODE_ENV === "development";

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (process.env.NODE_ENV !== "development") return;
        // Commit draft-and-commit fields (e.g. the counter endpoint) first:
        // blur fires their onBlur synchronously, so the store is current below.
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        const state = useEditorStore.getState();
        if (
          state.activeTerrainId &&
          hasUnsavedChanges(state) &&
          !state.saving
        ) {
          void state.saveChanges(state.activeTerrainId);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleExport = () => {
    if (!activeTerrain) return;
    const blob = new Blob([`${JSON.stringify(activeTerrain, null, 2)}\n`], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeTerrain.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const loadImport = (raw: string) => {
    try {
      const parsed: unknown = JSON.parse(raw);
      validateTerrain(
        parsed,
        new Set(blockTypes.blockTypes.map((blockType) => blockType.id)),
      );
      if (parsed.id !== activeTerrainId) {
        throw new Error(
          `imported terrain id "${parsed.id}" must match active terrain "${activeTerrainId}"`,
        );
      }
      importTerrain(parsed);
      setImportValue("");
      setImportError(null);
      setImportOpen(false);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "invalid terrain JSON");
    }
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    setImportValue(await file.text());
    setImportError(null);
  };

  const handleAddTerrain = () => {
    const id = window.prompt("New terrain id (lowercase letters, numbers, hyphens):");
    if (!id) return;
    try {
      validateTerrainId(id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "invalid terrain id");
      return;
    }
    if (doc.terrains.some((terrain) => terrain.id === id)) {
      window.alert(`Terrain "${id}" already exists.`);
      return;
    }
    const label = window.prompt("Label:", id.toUpperCase())?.trim() || id.toUpperCase();
    addTerrain(id, label);
  };

  const handleDeleteTerrain = async () => {
    if (!activeTerrain) return;
    if (activeTerrainId === doc.rootTerrainId) {
      window.alert("Cannot delete the root terrain.");
      return;
    }
    if (
      window.confirm(
        `Delete terrain "${activeTerrain.label}"? Persisted terrain files are removed immediately.`,
      )
    ) {
      await deleteTerrain(activeTerrainId);
    }
  };

  const handleRevert = () => {
    if (!activeTerrain) return;
    if (
      window.confirm(
        `Revert unsaved block type changes and changes to "${activeTerrain.label}"?`,
      )
    ) {
      revertChanges(activeTerrainId);
    }
  };

  const statusLabel =
    status === "clean"
      ? "Saved"
      : status === "dirty"
        ? "Unsaved"
        : status === "new"
          ? "New, unsaved"
          : status === "saving"
            ? "Saving…"
            : "Save failed";

  return (
    <header className="relative border-b border-cream/20 bg-brown px-4 py-2">
      <div className="flex items-center gap-3">
        <span className="font-block text-sm uppercase tracking-widest text-cream">
          Map Editor
        </span>
        <label className="ml-4 flex items-center gap-2">
          <span className="font-block text-xs uppercase text-cream/70">Terrain</span>
          <select
            value={activeTerrainId}
            onChange={(event) => requestTerrainSwitch(event.target.value)}
            className="border border-cream/30 bg-charcoal px-2 py-1 font-block text-sm uppercase text-cream"
          >
            {doc.terrains.map((terrain) => {
              const terrainStatus = getTerrainEditorStatus(
                useEditorStore.getState(),
                terrain.id,
              );
              const marker = terrainStatus === "clean" ? "" : " *";
              return (
                <option key={terrain.id} value={terrain.id}>
                  {terrain.label}
                  {marker}
                </option>
              );
            })}
          </select>
        </label>
        <span
          className={`font-block text-[10px] uppercase ${
            status === "clean" ? "text-cream/50" : "text-yellow-300"
          }`}
        >
          {statusLabel}
        </span>
        <button
          onClick={handleAddTerrain}
          className="border border-cream/30 bg-charcoal px-2 py-1 font-block text-xs uppercase text-cream hover:bg-cream/10"
        >
          + New
        </button>
          <button
            onClick={() => void handleDeleteTerrain()}
            disabled={saving || (!diskWritesEnabled && status !== "new")}
            className="border border-cream/30 bg-charcoal px-2 py-1 font-block text-xs uppercase text-cream hover:bg-cream/10 disabled:cursor-not-allowed disabled:opacity-40"
            title={
              diskWritesEnabled
                ? "Delete current terrain"
                : "Persisted terrains can only be deleted under npm run dev"
            }
          >
            Delete
        </button>
        <label
          className="flex items-center gap-2"
          title="Sky + water preset from atmosphere.config.ts, in both light and dark mode. Gen Surroundings applies its surroundings palette."
        >
          <span className="font-block text-xs uppercase text-cream/70">Atmosphere</span>
          <select
            value={activeAtmosphere ?? ""}
            onChange={(event) =>
              setTerrainAtmosphere(activeTerrainId, event.target.value || undefined)
            }
            disabled={!activeTerrain}
            className="border border-cream/30 bg-charcoal px-2 py-1 font-block text-xs uppercase text-cream disabled:opacity-40"
          >
            <option value="">(default)</option>
            {Object.entries(atmospheres)
              .filter(([id]) => TERRAIN_ID_PATTERN.test(id))
              .map(([id, preset]) => (
              <option key={id} value={id}>
                {preset.label}
              </option>
            ))}
            {activeAtmosphere && !getAtmosphere(activeAtmosphere) && (
              <option value={activeAtmosphere}>{activeAtmosphere} (unknown)</option>
            )}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setTestMode(!testMode)}
            className={`px-3 py-1 font-block text-xs uppercase ${
              testMode
                ? "bg-yellow-400 text-charcoal"
                : "border border-cream/30 bg-charcoal text-cream hover:bg-cream/10"
            }`}
            title={
              testMode
                ? "Test mode ON — buttons navigate. Click to return to edit mode."
                : "Edit mode — buttons select. Click to enable Test mode."
            }
          >
            {testMode ? "Test: ON" : "Test: OFF"}
          </button>
          <button
            onClick={() => void generateSurroundings(activeTerrainId)}
            disabled={!diskWritesEnabled || saving}
            className="border border-cream/30 bg-charcoal px-3 py-1 font-block text-xs uppercase text-cream hover:bg-cream/10 disabled:cursor-not-allowed disabled:opacity-40"
            title={
              diskWritesEnabled
                ? "Generate decorative surroundings for the current terrain"
                : "Surroundings generation is only available under npm run dev"
            }
          >
            Gen Surroundings
          </button>
          <button
            onClick={() => void saveChanges(activeTerrainId)}
            disabled={!diskWritesEnabled || !hasUnsaved || status === "saving"}
            className="bg-cream px-3 py-1 font-block text-xs uppercase text-charcoal hover:bg-cream/80 disabled:cursor-not-allowed disabled:opacity-40"
            title={
              diskWritesEnabled
                ? "Save block types and the current terrain (Ctrl/Cmd+S)"
                : "Disk saving is only available under npm run dev"
            }
          >
            {status === "saving" ? "Saving…" : "Save Changes"}
          </button>
          <button
            onClick={handleRevert}
            disabled={!hasUnsaved || status === "saving"}
            className="border border-cream/30 bg-charcoal px-3 py-1 font-block text-xs uppercase text-cream hover:bg-cream/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Revert Changes
          </button>
          <button
            onClick={handleExport}
            className="border border-cream/30 bg-charcoal px-3 py-1 font-block text-xs uppercase text-cream hover:bg-cream/10"
          >
            Export Current
          </button>
          <button
            onClick={() => {
              setImportOpen((open) => !open);
              setImportError(null);
            }}
            className="border border-cream/30 bg-charcoal px-3 py-1 font-block text-xs uppercase text-cream hover:bg-cream/10"
          >
            Import Current
          </button>
        </div>
      </div>

      {activeError && (
        <div className="mt-2 border border-red-400/50 bg-red-950/50 px-3 py-2 text-xs text-red-100">
          {activeError}
        </div>
      )}

      {importOpen && (
        <div className="absolute right-4 top-12 z-50 w-96 rounded border border-cream/30 bg-charcoal p-3 shadow-lg">
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => void handleImportFile(event.target.files?.[0])}
            className="mb-2 block w-full text-xs text-cream/70 file:mr-2 file:border-0 file:bg-cream file:px-2 file:py-1 file:text-charcoal"
          />
          <textarea
            value={importValue}
            onChange={(event) => {
              setImportValue(event.target.value);
              setImportError(null);
            }}
            placeholder={`Paste ${activeTerrainId}.json…`}
            className="h-48 w-full bg-brown p-2 font-mono text-xs text-cream"
          />
          {importError && <p className="mt-2 text-xs text-red-300">{importError}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => {
                setImportOpen(false);
                setImportError(null);
              }}
              className="px-3 py-1 text-xs text-cream hover:text-cream/70"
            >
              Cancel
            </button>
            <button
              onClick={() => loadImport(importValue)}
              disabled={!importValue.trim()}
              className="bg-cream px-3 py-1 text-xs uppercase text-charcoal hover:bg-cream/80 disabled:opacity-40"
            >
              Load
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
