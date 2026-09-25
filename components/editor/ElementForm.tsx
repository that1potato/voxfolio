"use client";

import { useEditorStore } from "@/lib/editor-store";
import type {
  TerrainElementPatch,
  TerrainBlockPosition,
} from "@/lib/terrains";
import { getButtonContentMode } from "@/lib/terrains";
import { OrientationField } from "./OrientationField";
import { ButtonElementFields } from "./ButtonElementFields";
import { CounterElementFields } from "./CounterElementFields";
import { ElementAppearanceFields } from "./ElementAppearanceFields";
import {
  AttachedImageFields,
  isImageAttachableElement,
  StandaloneImageFields,
} from "./ElementImageFields";
import { inputClass, labelClass } from "./element-form-fields";

export function ElementForm() {
  const doc = useEditorStore((state) => state.doc);
  const activeTerrainId = useEditorStore((state) => state.activeTerrainId);
  const selectedElementId = useEditorStore((state) => state.selectedElementId);
  const updateElement = useEditorStore((state) => state.updateElement);
  const deleteElement = useEditorStore((state) => state.deleteElement);
  const setSelectedElementId = useEditorStore((state) => state.setSelectedElementId);
  const imageSurfacePickEnabled = useEditorStore(
    (state) => state.imageSurfacePickEnabled,
  );
  const setImageSurfacePickEnabled = useEditorStore(
    (state) => state.setImageSurfacePickEnabled,
  );

  const terrain = doc.terrains.find((item) => item.id === activeTerrainId);
  const element = terrain?.elements.find((item) => item.id === selectedElementId);
  if (!element || !terrain) return null;

  const patch = (next: TerrainElementPatch) =>
    updateElement(activeTerrainId, element.id, next);

  const setPosition = (axis: 0 | 1 | 2, value: number) => {
    const next = [...element.position] as TerrainBlockPosition;
    next[axis] = value;
    patch({ position: next });
  };

  const setScale = (value: number) => {
    const scale = Number.isFinite(value) && value > 0 ? value : 1;
    patch({
      scale: Math.abs(scale - 1) < 1e-6 ? undefined : scale,
    });
  };

  return (
    <div className="mt-3 space-y-3 border-t border-cream/20 pt-3">
      <div className="flex items-center justify-between">
        <span className="font-block text-xs uppercase text-cream/60">
          Edit {element.type}
        </span>
        <button
          onClick={() => setSelectedElementId(null)}
          className="text-cream/60 hover:text-cream"
        >
          ×
        </button>
      </div>

      {element.type !== "image" && element.type !== "counter" && (
        <label>
          <span className={labelClass}>
            {element.type === "button" &&
            getButtonContentMode(element) === "image"
              ? "Semantic label"
              : "Text"}
          </span>
          <textarea
            value={element.text}
            onChange={(event) => patch({ text: event.target.value })}
            rows={2}
            className={inputClass + " font-mono"}
          />
        </label>
      )}

      {element.type === "counter" && (
        <CounterElementFields
          key={element.id}
          element={element}
          onPatch={patch}
        />
      )}

      <div className="grid grid-cols-3 gap-2">
        {(["X", "Y", "Z"] as const).map((axis, index) => (
          <label key={axis}>
            <span className={labelClass}>{axis}</span>
            <input
              type="number"
              step={0.5}
              value={element.position[index]}
              onChange={(event) =>
                setPosition(
                  index as 0 | 1 | 2,
                  Number.parseFloat(event.target.value) || 0,
                )
              }
              className={inputClass}
            />
          </label>
        ))}
      </div>

      <label>
        <span className={labelClass}>Scale</span>
        <input
          type="number"
          min={0.05}
          step={0.05}
          value={Number((element.scale ?? 1).toFixed(3))}
          onChange={(event) =>
            setScale(Number.parseFloat(event.target.value))
          }
          className={inputClass}
        />
      </label>

      <label>
        <span className={labelClass}>
          RotationY ({((element.rotationY ?? 0) * (180 / Math.PI)).toFixed(0)}°)
        </span>
        <input
          type="range"
          min={-Math.PI}
          max={Math.PI}
          step={Math.PI / 36}
          value={element.rotationY ?? 0}
          onChange={(event) => {
            const rotationY = Number.parseFloat(event.target.value);
            patch({ rotationY: Math.abs(rotationY) < 1e-12 ? 0 : rotationY });
          }}
          className="w-full"
        />
      </label>

      <OrientationField
        value={element.orientation}
        onChange={(orientation) => patch({ orientation })}
      />

      {element.type !== "image" && (
        <ElementAppearanceFields element={element} onPatch={patch} />
      )}

      {element.type === "image" && (
        <StandaloneImageFields
          key={element.id}
          element={element}
          onPatch={patch}
          pickEnabled={imageSurfacePickEnabled}
          onPickEnabledChange={setImageSurfacePickEnabled}
        />
      )}

      {element.type === "button" && (
        <ButtonElementFields
          key={element.id}
          element={element}
          terrains={doc.terrains}
          activeTerrainId={activeTerrainId}
          onPatch={patch}
        />
      )}

      {isImageAttachableElement(element) && (
        <AttachedImageFields element={element} onPatch={patch} />
      )}

      <button
        onClick={() => {
          if (confirm("Delete this element?")) {
            deleteElement(activeTerrainId, element.id);
          }
        }}
        className="mt-2 w-full border border-red-900/60 bg-red-900/40 px-2 py-1 font-block text-xs uppercase text-cream hover:bg-red-900/60"
      >
        Delete element
      </button>
    </div>
  );
}
