"use client";

import { useEditorStore } from "@/lib/editor-store";
import type { TerrainElement } from "@/lib/terrains";
import { DEFAULT_COUNTER_DIGITS } from "@/lib/map-element-appearance";

function nextElementId(prefix: string, existing: TerrainElement[]): string {
  const max = existing
    .filter((e) => e.id.startsWith(prefix + "-"))
    .reduce((m, e) => {
      const n = parseInt(e.id.slice(prefix.length + 1), 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

export function ElementList() {
  const doc = useEditorStore((s) => s.doc);
  const activeTerrainId = useEditorStore((s) => s.activeTerrainId);
  const selectedElementId = useEditorStore((s) => s.selectedElementId);
  const setSelectedElementId = useEditorStore((s) => s.setSelectedElementId);
  const addElement = useEditorStore((s) => s.addElement);
  const deleteElement = useEditorStore((s) => s.deleteElement);

  const terrain = doc.terrains.find((t) => t.id === activeTerrainId);
  if (!terrain) return null;

  const center: [number, number, number] = [
    terrain.grid.originX + (terrain.grid.width - 1) / 2,
    1,
    terrain.grid.originZ + (terrain.grid.depth - 1) / 2,
  ];

  const handleAddTitle = () => {
    const id = nextElementId("t", terrain.elements);
    addElement(activeTerrainId, {
      id,
      type: "title",
      text: "TITLE",
      position: center,
      rotationY: 0,
      orientation: "ground",
    });
    setSelectedElementId(id);
  };

  const handleAddCaption = () => {
    const id = nextElementId("c", terrain.elements);
    addElement(activeTerrainId, {
      id,
      type: "caption",
      text: "Caption",
      position: [center[0], 0.5, center[2]],
      rotationY: 0,
      orientation: "ground",
    });
    setSelectedElementId(id);
  };

  const handleAddButton = () => {
    const id = nextElementId("b", terrain.elements);
    addElement(activeTerrainId, {
      id,
      type: "button",
      text: "BUTTON",
      position: [center[0], 0.7, center[2]],
      rotationY: 0,
      orientation: "ground",
      width: 7,
      depth: 1.8,
      targetTerrainId: null,
      contentSectionId: null,
      contentItemSlug: null,
      href: null,
    });
    setSelectedElementId(id);
  };

  const handleAddImage = () => {
    const id = nextElementId("i", terrain.elements);
    addElement(activeTerrainId, {
      id,
      type: "image",
      src: "",
      alt: "",
      position: [center[0], 1.03, center[2]],
      rotationY: 0,
      orientation: "ground",
      width: 4,
      height: 4,
      opacity: 1,
    });
    setSelectedElementId(id);
  };

  const handleAddCounter = () => {
    const id = nextElementId("n", terrain.elements);
    addElement(activeTerrainId, {
      id,
      type: "counter",
      position: [center[0], 0.5, center[2]],
      rotationY: 0,
      orientation: "ground",
      digits: DEFAULT_COUNTER_DIGITS,
      value: 0,
    });
    setSelectedElementId(id);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        <button
          onClick={handleAddTitle}
          className="border border-cream/30 bg-charcoal px-2 py-1 font-block text-[10px] uppercase text-cream hover:bg-cream/10"
        >
          + Title
        </button>
        <button
          onClick={handleAddCaption}
          className="border border-cream/30 bg-charcoal px-2 py-1 font-block text-[10px] uppercase text-cream hover:bg-cream/10"
        >
          + Caption
        </button>
        <button
          onClick={handleAddButton}
          className="border border-cream/30 bg-charcoal px-2 py-1 font-block text-[10px] uppercase text-cream hover:bg-cream/10"
        >
          + Button
        </button>
        <button
          onClick={handleAddImage}
          className="border border-cream/30 bg-charcoal px-2 py-1 font-block text-[10px] uppercase text-cream hover:bg-cream/10"
        >
          + Image
        </button>
        <button
          onClick={handleAddCounter}
          className="border border-cream/30 bg-charcoal px-2 py-1 font-block text-[10px] uppercase text-cream hover:bg-cream/10"
        >
          + Counter
        </button>
      </div>

      <ul className="space-y-1">
        {terrain.elements.length === 0 && (
          <li className="text-xs text-cream/40">No elements yet.</li>
        )}
        {terrain.elements.map((el) => {
          const selected = el.id === selectedElementId;
          const previewText =
            el.type === "image"
              ? el.alt || el.src || "(choose image)"
              : el.type === "counter"
                ? el.endpoint || String(el.value ?? 0)
                : el.text;
          const preview =
            previewText.replace(/\n/g, " ").slice(0, 18) +
            (previewText.length > 18 ? "…" : "");
          return (
            <li
              key={el.id}
              onClick={() =>
                setSelectedElementId(selected ? null : el.id)
              }
              className={`flex cursor-pointer items-center justify-between px-2 py-1 text-xs ${
                selected ? "bg-cream/20 text-cream" : "text-cream/80 hover:bg-cream/10"
              }`}
            >
              <span className="flex items-center gap-2 overflow-hidden">
                <span className="font-block text-[10px] uppercase text-cream/60">
                  {el.type}
                </span>
                <span className="truncate">{preview}</span>
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteElement(activeTerrainId, el.id);
                }}
                className="ml-2 text-cream/50 hover:text-cream"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
