"use client";

import { useEditorStore } from "@/lib/editor-store";

export function UnsavedTerrainDialog() {
  const doc = useEditorStore((state) => state.doc);
  const activeTerrainId = useEditorStore((state) => state.activeTerrainId);
  const pendingTerrainId = useEditorStore((state) => state.pendingTerrainId);
  const saving = useEditorStore((state) => state.saving);
  const error = useEditorStore((state) => state.saveError);
  const saveAndSwitch = useEditorStore((state) => state.saveAndSwitch);
  const discardAndSwitch = useEditorStore((state) => state.discardAndSwitch);
  const cancelTerrainSwitch = useEditorStore((state) => state.cancelTerrainSwitch);

  if (!pendingTerrainId) return null;

  const active = doc.terrains.find((terrain) => terrain.id === activeTerrainId);
  const pending = doc.terrains.find((terrain) => terrain.id === pendingTerrainId);
  const diskWritesEnabled = process.env.NODE_ENV === "development";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-charcoal/80 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-terrain-title"
        className="w-full max-w-md border-2 border-cream bg-brownDark p-5 shadow-2xl"
      >
        <h2 id="unsaved-terrain-title" className="font-block text-lg uppercase text-cream">
          Unsaved terrain
        </h2>
        <p className="mt-3 text-sm text-cream/80">
          Save changes to <strong>{active?.label ?? activeTerrainId}</strong> before
          switching to <strong>{pending?.label ?? pendingTerrainId}</strong>?
        </p>
        {error && (
          <p className="mt-3 border border-red-400/50 bg-red-950/50 px-3 py-2 text-xs text-red-100">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            onClick={cancelTerrainSwitch}
            disabled={saving}
            className="border border-cream/30 bg-charcoal px-3 py-2 font-block text-xs uppercase text-cream hover:bg-cream/10 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={discardAndSwitch}
            disabled={saving}
            className="border border-red-400/50 bg-red-950/50 px-3 py-2 font-block text-xs uppercase text-cream hover:bg-red-900/60 disabled:opacity-40"
          >
            Discard and Switch
          </button>
          <button
            onClick={() => void saveAndSwitch()}
            disabled={saving || !diskWritesEnabled}
            className="bg-cream px-3 py-2 font-block text-xs uppercase text-charcoal hover:bg-cream/80 disabled:opacity-40"
            title={
              diskWritesEnabled
                ? "Save block types and the active terrain, then continue"
                : "Disk saving is only available under npm run dev"
            }
          >
            {saving ? "Saving…" : "Save and Switch"}
          </button>
        </div>
      </div>
    </div>
  );
}
