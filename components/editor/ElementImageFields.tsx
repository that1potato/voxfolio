"use client";

import { useState } from "react";
import type {
  ImageElement,
  MapImageAttachment,
  TerrainElementPatch,
} from "@/lib/terrains";
import { getButtonContentMode } from "@/lib/terrains";
import { ImageSourceFields } from "./ImageSourceFields";
import {
  defaultAttachment,
  inputClass,
  isImageAttachableElement,
  labelClass,
  type ImageAttachableElement,
} from "./element-form-fields";

interface AttachedImageFieldsProps {
  element: ImageAttachableElement;
  onPatch: (next: TerrainElementPatch) => void;
}

export function AttachedImageFields({
  element,
  onPatch,
}: AttachedImageFieldsProps) {
  return (
    <div className="space-y-2 border-t border-cream/20 pt-3">
      <div className="flex items-center justify-between">
        <span className="font-block text-[10px] uppercase text-cream/60">
          Attached image
        </span>
        {element.image ? (
          <button
            onClick={() => {
              if (
                element.type === "button" &&
                getButtonContentMode(element) !== "caption"
              ) {
                onPatch({
                  image: undefined,
                  contentMode: "caption",
                });
              } else {
                onPatch({ image: undefined });
              }
            }}
            className="text-xs text-red-300 hover:text-red-200"
          >
            Remove
          </button>
        ) : (
          <button
            onClick={() =>
              onPatch({
                image: defaultAttachment(element),
                ...(element.type === "button"
                  ? { contentMode: "captionImage" as const }
                  : {}),
              })
            }
            className="border border-cream/30 px-2 py-1 font-block text-[10px] uppercase text-cream hover:bg-cream/10"
          >
            + Add image
          </button>
        )}
      </div>

      {element.image && (
        <AttachmentFields
          image={element.image}
          showSide={
            element.type !== "button" ||
            getButtonContentMode(element) === "captionImage"
          }
          onChange={(image) => onPatch({ image })}
        />
      )}
    </div>
  );
}

export { isImageAttachableElement };

function AttachmentFields({
  image,
  showSide,
  onChange,
}: {
  image: MapImageAttachment;
  showSide: boolean;
  onChange: (image: MapImageAttachment) => void;
}) {
  const patch = (next: Partial<MapImageAttachment>) =>
    onChange({ ...image, ...next });

  return (
    <div className="space-y-3">
      <ImageSourceFields
        src={image.src}
        alt={image.alt}
        onSrcChange={(src) => patch({ src })}
        onAltChange={(alt) => patch({ alt })}
      />

      <div className={showSide ? "grid grid-cols-3 gap-2" : "grid grid-cols-1 gap-2"}>
        {showSide && (
          <label>
            <span className={labelClass}>Side</span>
            <select
              value={image.side}
              onChange={(event) =>
                patch({ side: event.target.value as MapImageAttachment["side"] })
              }
              className={inputClass}
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>
        )}
        <label>
          <span className={labelClass}>Size</span>
          <input
            type="number"
            min={0.1}
            max={200}
            step={0.1}
            value={image.size}
            onChange={(event) =>
              patch({ size: Number.parseFloat(event.target.value) || 1 })
            }
            className={inputClass}
          />
        </label>
        {showSide && (
          <label>
            <span className={labelClass}>Gap</span>
            <input
              type="number"
              min={0}
              max={200}
              step={0.1}
              value={image.gap ?? 0.35}
              onChange={(event) =>
                patch({ gap: Math.max(0, Number.parseFloat(event.target.value) || 0) })
              }
              className={inputClass}
            />
          </label>
        )}
      </div>
    </div>
  );
}

interface StandaloneImageFieldsProps {
  element: ImageElement;
  onPatch: (next: TerrainElementPatch) => void;
  pickEnabled: boolean;
  onPickEnabledChange: (value: boolean) => void;
}

export function StandaloneImageFields({
  element,
  onPatch,
  pickEnabled,
  onPickEnabledChange,
}: StandaloneImageFieldsProps) {
  const [sourceAspectRatio, setSourceAspectRatio] = useState<number | null>(null);
  const [lockAspectRatio, setLockAspectRatio] = useState(true);

  const setWidth = (width: number) => {
    const next: TerrainElementPatch = { width };
    if (lockAspectRatio && sourceAspectRatio) {
      next.height = width / sourceAspectRatio;
    }
    onPatch(next);
  };

  const setHeight = (height: number) => {
    const next: TerrainElementPatch = { height };
    if (lockAspectRatio && sourceAspectRatio) {
      next.width = height * sourceAspectRatio;
    }
    onPatch(next);
  };

  return (
    <div className="space-y-3 border-t border-cream/20 pt-3">
      <ImageSourceFields
        src={element.src}
        alt={element.alt}
        onSrcChange={(src) => onPatch({ src })}
        onAltChange={(alt) => onPatch({ alt })}
        onAspectRatioChange={setSourceAspectRatio}
      />

      <div className="space-y-2 border border-cream/20 bg-charcoal/35 p-2">
        <div className="flex items-center justify-between gap-2">
          <span className={labelClass}>Surface anchor</span>
          <button
            type="button"
            onClick={() => onPickEnabledChange(!pickEnabled)}
            className={`border px-2 py-1 font-block text-[10px] uppercase ${
              pickEnabled
                ? "border-amber-300 bg-amber-300/20 text-amber-100"
                : "border-cream/30 text-cream hover:bg-cream/10"
            }`}
          >
            {pickEnabled ? "Picking..." : "Pick surface"}
          </button>
        </div>
        {element.surface ? (
          <div className="space-y-2 text-xs text-cream/65">
            <div>
              {element.surface.face} face at [{element.surface.block.join(", ")}]
            </div>
            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <label>
                <span className={labelClass}>Surface offset</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.005}
                  value={element.surface.offset ?? 0.035}
                  onChange={(event) => {
                    if (!element.surface) return;
                    onPatch({
                      surface: {
                        ...element.surface,
                        offset: Math.max(
                          0,
                          Number.parseFloat(event.target.value) || 0,
                        ),
                      },
                    });
                  }}
                  className={inputClass}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  onPatch({ surface: undefined });
                  onPickEnabledChange(false);
                }}
                className="border border-cream/30 px-2 py-1 font-block text-[10px] uppercase text-cream hover:bg-cream/10"
              >
                Detach
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-cream/45">
            Click Pick surface, then click an exposed block face in the preview.
          </p>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs text-cream/80">
        <input
          type="checkbox"
          checked={lockAspectRatio}
          onChange={(event) => setLockAspectRatio(event.target.checked)}
        />
        Lock source aspect ratio
        {sourceAspectRatio && (
          <span className="text-cream/45">{sourceAspectRatio.toFixed(2)}:1</span>
        )}
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className={labelClass}>Width</span>
          <input
            type="number"
            min={0.1}
            max={200}
            step={0.1}
            value={Number(element.width.toFixed(3))}
            onChange={(event) =>
              setWidth(Number.parseFloat(event.target.value) || 1)
            }
            className={inputClass}
          />
        </label>
        <label>
          <span className={labelClass}>Height</span>
          <input
            type="number"
            min={0.1}
            max={200}
            step={0.1}
            value={Number(element.height.toFixed(3))}
            onChange={(event) =>
              setHeight(Number.parseFloat(event.target.value) || 1)
            }
            className={inputClass}
          />
        </label>
      </div>

      <label>
        <span className={labelClass}>
          Opacity ({Math.round((element.opacity ?? 1) * 100)}%)
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={element.opacity ?? 1}
          onChange={(event) =>
            onPatch({ opacity: Number.parseFloat(event.target.value) })
          }
          className="w-full"
        />
      </label>
    </div>
  );
}
