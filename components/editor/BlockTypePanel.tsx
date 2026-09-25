"use client";

import { useEditorStore } from "@/lib/editor-store";
import { validateBlockTypeId } from "@/lib/terrains";
import { resolveThemeColor } from "@/lib/theme-colors";
import type { SiteThemeMode } from "@/theme.config";

const inputClass =
  "w-full border border-cream/30 bg-charcoal px-2 py-1 text-xs text-cream";

export function BlockTypePanel({ themeMode }: { themeMode: SiteThemeMode }) {
  const doc = useEditorStore((state) => state.doc);
  const blockTypes = useEditorStore((state) => state.blockTypes);
  const activeBlockTypeId = useEditorStore((state) => state.activeBlockTypeId);
  const setActiveBlockTypeId = useEditorStore((state) => state.setActiveBlockTypeId);
  const addBlockType = useEditorStore((state) => state.addBlockType);
  const updateBlockType = useEditorStore((state) => state.updateBlockType);
  const setDefaultBlockType = useEditorStore((state) => state.setDefaultBlockType);
  const deleteBlockType = useEditorStore((state) => state.deleteBlockType);
  const active =
    blockTypes.blockTypes.find((blockType) => blockType.id === activeBlockTypeId) ??
    blockTypes.blockTypes[0];

  if (!active) return null;

  const used = doc.terrains.some((terrain) =>
    terrain.grid.layers.some((layer) =>
      Object.prototype.hasOwnProperty.call(layer.masks, active.id),
    ),
  );
  const isDefault = blockTypes.defaultBlockTypeId === active.id;
  const canDelete = blockTypes.blockTypes.length > 1 && !isDefault && !used;

  const handleAdd = () => {
    const id = window.prompt("New block type id (lowercase letters, numbers, hyphens):");
    if (!id) return;
    try {
      validateBlockTypeId(id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "invalid block type id");
      return;
    }
    if (blockTypes.blockTypes.some((blockType) => blockType.id === id)) {
      window.alert(`Block type "${id}" already exists.`);
      return;
    }
    const label = window.prompt("Label:", id.toUpperCase())?.trim() || id.toUpperCase();
    addBlockType({
      id,
      label,
      appearance: {
        light: "#7a6a58",
        dark: "#5a4a3d",
      },
    });
  };

  const handleDelete = () => {
    if (!canDelete) return;
    if (window.confirm(`Delete unused block type "${active.label}"?`)) {
      deleteBlockType(active.id);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-block text-xs uppercase tracking-widest text-cream/60">
          Block Types
        </h3>
        <button
          onClick={handleAdd}
          className="border border-cream/30 bg-charcoal px-2 py-1 font-block text-[10px] uppercase text-cream hover:bg-cream/10"
        >
          + New
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1">
        {blockTypes.blockTypes.map((blockType) => {
          const selected = blockType.id === active.id;
          return (
            <button
              key={blockType.id}
              onClick={() => setActiveBlockTypeId(blockType.id)}
              className={`flex min-w-0 items-center gap-2 border px-2 py-1 text-left ${
                selected
                  ? "border-cream bg-cream/15 text-cream"
                  : "border-cream/20 bg-charcoal text-cream/75 hover:bg-cream/10"
              }`}
            >
              <span
                className="h-4 w-4 shrink-0 border border-cream/30"
                style={{
                  backgroundColor: resolveThemeColor(
                    blockType.appearance,
                    themeMode,
                  ),
                }}
              />
              <span className="truncate font-block text-[10px] uppercase">
                {blockType.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2 border-t border-cream/20 pt-3">
        <div className="font-mono text-[10px] text-cream/45">ID: {active.id}</div>
        <label className="block">
          <span className="font-block text-[10px] uppercase text-cream/60">Label</span>
          <input
            value={active.label}
            onChange={(event) =>
              updateBlockType(active.id, { label: event.target.value })
            }
            className={inputClass}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="font-block text-[10px] uppercase text-cream/60">Light</span>
            <input
              type="color"
              value={active.appearance.light}
              onChange={(event) =>
                updateBlockType(active.id, {
                  appearance: {
                    ...active.appearance,
                    light: event.target.value,
                  },
                })
              }
              className="h-8 w-full border border-cream/30 bg-charcoal p-1"
            />
          </label>
          <label>
            <span className="font-block text-[10px] uppercase text-cream/60">
              Dark
            </span>
            <input
              type="color"
              value={active.appearance.dark}
              onChange={(event) =>
                updateBlockType(active.id, {
                  appearance: {
                    ...active.appearance,
                    dark: event.target.value,
                  },
                })
              }
              className="h-8 w-full border border-cream/30 bg-charcoal p-1"
            />
          </label>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setDefaultBlockType(active.id)}
            disabled={isDefault}
            className="flex-1 border border-cream/30 bg-charcoal px-2 py-1 font-block text-[10px] uppercase text-cream hover:bg-cream/10 disabled:opacity-40"
          >
            {isDefault ? "Default" : "Make Default"}
          </button>
          <button
            onClick={handleDelete}
            disabled={!canDelete}
            title={
              isDefault
                ? "Choose another default before deleting"
                : used
                  ? "This block type is used by a terrain"
                  : blockTypes.blockTypes.length <= 1
                    ? "At least one block type is required"
                    : "Delete block type"
            }
            className="border border-red-400/40 bg-red-950/40 px-2 py-1 font-block text-[10px] uppercase text-red-100 hover:bg-red-900/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
