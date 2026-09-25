import { useState } from "react";
import { sections } from "@/site.config";
import type {
  ButtonContentMode,
  ButtonElement,
  Terrain,
  TerrainElementPatch,
} from "@/lib/terrains";
import { getButtonContentMode } from "@/lib/terrains";
import { useEditorStore } from "@/lib/editor-store";
import {
  defaultAttachment,
  inputClass,
  labelClass,
} from "./element-form-fields";

interface Props {
  element: ButtonElement;
  terrains: Terrain[];
  activeTerrainId: string;
  onPatch: (next: TerrainElementPatch) => void;
}

type ButtonActionType = "none" | "terrain" | "section" | "href";

function getButtonActionType(element: ButtonElement): ButtonActionType {
  if (element.targetTerrainId) return "terrain";
  if (element.contentSectionId) return "section";
  if (element.href) return "href";
  return "none";
}

export function ButtonElementFields({
  element,
  terrains,
  activeTerrainId,
  onPatch,
}: Props) {
  const derivedActionType = getButtonActionType(element);
  const [actionType, setSelectedActionType] =
    useState<ButtonActionType>(derivedActionType);
  const availableHoverItems = useEditorStore((state) => state.availableHoverItems);

  const setActionType = (nextActionType: ButtonActionType) => {
    setSelectedActionType(nextActionType);
    onPatch({
      targetTerrainId: null,
      contentSectionId: null,
      contentItemSlug: null,
      href: null,
    });
  };

  return (
    <>
      <ButtonContentFields element={element} onPatch={onPatch} />

      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className={labelClass}>Width</span>
          <input
            type="number"
            min={0.1}
            step={0.5}
            value={element.width ?? 7}
            onChange={(event) =>
              onPatch({
                width: Number.parseFloat(event.target.value) || 7,
              })
            }
            className={inputClass}
          />
        </label>
        <label>
          <span className={labelClass}>
            {element.orientation === "upright" ? "Height" : "Depth"}
          </span>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={element.depth ?? 1.8}
            onChange={(event) =>
              onPatch({
                depth: Number.parseFloat(event.target.value) || 1.8,
              })
            }
            className={inputClass}
          />
        </label>
      </div>

      <label>
        <span className={labelClass}>Action</span>
        <select
          value={actionType}
          onChange={(event) =>
            setActionType(event.target.value as ButtonActionType)
          }
          className={inputClass}
        >
          <option value="none">None</option>
          <option value="terrain">Target terrain</option>
          <option value="section">Content section</option>
          <option value="href">Hyperlink</option>
        </select>
      </label>

      {actionType === "terrain" && (
        <label>
          <span className={labelClass}>Target terrain (in-scene nav)</span>
          <select
            value={element.targetTerrainId ?? ""}
            onChange={(event) =>
              onPatch({
                targetTerrainId: event.target.value || null,
                contentSectionId: null,
                contentItemSlug: null,
                href: null,
              })
            }
            className={inputClass}
          >
            <option value="">(none)</option>
            {terrains
              .filter((item) => item.id !== activeTerrainId)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} ({item.id})
                </option>
              ))}
          </select>
        </label>
      )}

      {actionType === "section" && (
        <label>
          <span className={labelClass}>Content section (open MDX)</span>
          <select
            value={element.contentSectionId ?? ""}
            onChange={(event) =>
              onPatch({
                targetTerrainId: null,
                contentSectionId: event.target.value || null,
                contentItemSlug: event.target.value ? element.contentItemSlug ?? null : null,
                href: null,
              })
            }
            className={inputClass}
          >
            <option value="">(none)</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label} ({section.id})
              </option>
            ))}
          </select>
        </label>
      )}

      {actionType === "section" && element.contentSectionId && (
        <label>
          <span className={labelClass}>Content item slug (optional)</span>
          <input
            type="text"
            value={element.contentItemSlug ?? ""}
            placeholder="my-project"
            onChange={(event) =>
              onPatch({
                contentItemSlug: event.target.value || null,
              })
            }
            className={inputClass}
          />
        </label>
      )}

      {actionType === "href" && (
        <label>
          <span className={labelClass}>Hyperlink</span>
          <input
            type="url"
            value={element.href ?? ""}
            placeholder="https://example.com or mailto:name@example.com"
            onChange={(event) =>
              onPatch({
                targetTerrainId: null,
                contentSectionId: null,
                contentItemSlug: null,
                href: event.target.value || null,
              })
            }
            className={inputClass}
          />
        </label>
      )}

      <div className="space-y-2 border-t border-cream/20 pt-3">
        <label>
          <span className={labelClass}>Hover card → item</span>
          <select
            value={element.hoverCardItem ?? ""}
            onChange={(event) =>
              onPatch({ hoverCardItem: event.target.value || null })
            }
            className={inputClass}
          >
            <option value="">(none — no hover card)</option>
            {availableHoverItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} ({item.id})
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}

function ButtonContentFields({
  element,
  onPatch,
}: {
  element: ButtonElement;
  onPatch: (next: TerrainElementPatch) => void;
}) {
  const mode = getButtonContentMode(element);

  const setMode = (contentMode: ButtonContentMode) => {
    const needsImage = contentMode === "image" || contentMode === "captionImage";
    onPatch({
      contentMode,
      image: needsImage ? (element.image ?? defaultAttachment(element)) : undefined,
      text:
        contentMode === "image" && element.text.trim().length === 0
          ? "Button"
          : element.text,
    });
  };

  return (
    <div className="space-y-2 border-t border-cream/20 pt-3">
      <label>
        <span className={labelClass}>Content</span>
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value as ButtonContentMode)}
          className={inputClass}
        >
          <option value="caption">Caption only</option>
          <option value="image">Image only</option>
          <option value="captionImage">Caption + image</option>
        </select>
      </label>
      <label>
        <span className={labelClass}>Content padding</span>
        <input
          type="number"
          min={0}
          max={200}
          step={0.05}
          value={element.contentPadding ?? 0.35}
          onChange={(event) =>
            onPatch({
              contentPadding: Math.max(
                0,
                Number.parseFloat(event.target.value) || 0,
              ),
            })
          }
          className={inputClass}
        />
      </label>
    </div>
  );
}
