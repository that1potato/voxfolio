import { useEffect, useState } from "react";
import type { CounterElement, TerrainElementPatch } from "@/lib/terrains";
import { validateImageSource } from "@/lib/terrains";
import { DEFAULT_COUNTER_DIGITS } from "@/lib/map-element-appearance";
import { inputClass, labelClass } from "./element-form-fields";

const MAX_COUNTER_DIGITS = 12;

interface Props {
  element: CounterElement;
  onPatch: (next: TerrainElementPatch) => void;
}

export function CounterElementFields({ element, onPatch }: Props) {
  // The endpoint is fetched as soon as it changes, so edit a draft and commit
  // on blur / Enter instead of fetching every partially typed URL.
  const [endpointDraft, setEndpointDraft] = useState(element.endpoint ?? "");
  const [endpointError, setEndpointError] = useState<string | null>(null);
  const draftDirty = (endpointDraft.trim() || undefined) !== element.endpoint;

  // An uncommitted draft isn't in the store yet, so the editor-wide unload
  // guard can't see it — warn here until it's committed.
  useEffect(() => {
    if (!draftDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [draftDirty]);

  const commitEndpoint = () => {
    const endpoint = endpointDraft.trim() || undefined;
    if (endpoint !== undefined) {
      try {
        validateImageSource(endpoint, "endpoint");
      } catch (error) {
        setEndpointError(error instanceof Error ? error.message : "invalid endpoint");
        return;
      }
    }
    setEndpointError(null);
    setEndpointDraft(endpoint ?? "");
    if (endpoint !== element.endpoint) onPatch({ endpoint });
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className={labelClass}>Digits</span>
          <input
            type="number"
            min={1}
            max={MAX_COUNTER_DIGITS}
            step={1}
            value={element.digits ?? DEFAULT_COUNTER_DIGITS}
            onChange={(event) => {
              const digits = Number.parseInt(event.target.value, 10);
              onPatch({
                digits: Number.isFinite(digits)
                  ? Math.min(MAX_COUNTER_DIGITS, Math.max(1, digits))
                  : DEFAULT_COUNTER_DIGITS,
              });
            }}
            className={inputClass}
          />
        </label>
        <label>
          <span className={labelClass}>Value</span>
          <input
            type="number"
            min={0}
            step={1}
            value={element.value ?? 0}
            onChange={(event) => {
              const value = Number.parseInt(event.target.value, 10);
              onPatch({
                value: Number.isFinite(value)
                  ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, value))
                  : 0,
              });
            }}
            className={inputClass}
          />
        </label>
      </div>

      <label>
        <span className={labelClass}>Endpoint (optional)</span>
        <input
          type="text"
          value={endpointDraft}
          placeholder="/api/count or https://…"
          onChange={(event) => {
            setEndpointDraft(event.target.value);
            setEndpointError(null);
          }}
          onBlur={commitEndpoint}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitEndpoint();
          }}
          className={inputClass + " font-mono"}
        />
        <span className="mt-1 block text-[10px] text-cream/45">
          Fetched once per page load; a JSON {"{ \"count\": number }"} response
          replaces Value.
        </span>
      </label>
      {endpointError && <p className="text-xs text-red-300">{endpointError}</p>}
    </div>
  );
}
