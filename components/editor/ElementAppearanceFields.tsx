import type {
  ButtonElement,
  ButtonElementAppearance,
  ImageElement,
  TerrainElement,
  TerrainElementPatch,
} from "@/lib/terrains";
import type { ThemeColorPair } from "@/lib/theme-colors";
import {
  DEFAULT_BUTTON_ELEMENT_APPEARANCE,
  DEFAULT_COUNTER_ELEMENT_APPEARANCE,
  DEFAULT_TEXT_ELEMENT_APPEARANCE,
} from "@/lib/map-element-appearance";
import { labelClass } from "./element-form-fields";

interface Props {
  element: Exclude<TerrainElement, ImageElement>;
  onPatch: (next: TerrainElementPatch) => void;
}

export function ElementAppearanceFields({ element, onPatch }: Props) {
  if (element.type === "title" || element.type === "caption") {
    return (
      <div className="space-y-2 border-t border-cream/20 pt-3">
        <span className="font-block text-[10px] uppercase text-cream/60">
          Colors
        </span>
        <ThemeColorPairFields
          label="Text"
          value={element.appearance?.color}
          defaults={DEFAULT_TEXT_ELEMENT_APPEARANCE.color}
          onChange={(color) =>
            onPatch({
              appearance: color ? { color } : undefined,
            })
          }
        />
      </div>
    );
  }

  if (element.type === "counter") {
    return (
      <div className="space-y-2 border-t border-cream/20 pt-3">
        <span className="font-block text-[10px] uppercase text-cream/60">
          Colors
        </span>
        <ThemeColorPairFields
          label="Glow"
          value={element.appearance?.glow}
          defaults={DEFAULT_COUNTER_ELEMENT_APPEARANCE.glow}
          onChange={(glow) =>
            onPatch({
              appearance: { ...element.appearance, glow: glow ?? undefined },
            })
          }
        />
        <ThemeColorPairFields
          label="Glass"
          value={element.appearance?.glass}
          defaults={DEFAULT_COUNTER_ELEMENT_APPEARANCE.glass}
          onChange={(glass) =>
            onPatch({
              appearance: { ...element.appearance, glass: glass ?? undefined },
            })
          }
        />
      </div>
    );
  }

  return <ButtonAppearanceFields element={element} onPatch={onPatch} />;
}

function ButtonAppearanceFields({
  element,
  onPatch,
}: {
  element: ButtonElement;
  onPatch: (next: TerrainElementPatch) => void;
}) {
  const setButtonColor = (
    role: keyof ButtonElementAppearance,
    colors: ThemeColorPair | undefined,
  ) => {
    const appearance: ButtonElementAppearance = {
      main: element.appearance?.main,
      text: element.appearance?.text,
      edge: element.appearance?.edge,
      [role]: colors,
    };
    if (!colors) delete appearance[role];
    onPatch({
      appearance:
        Object.keys(appearance).length > 0 ? appearance : undefined,
    });
  };

  return (
    <div className="space-y-2 border-t border-cream/20 pt-3">
      <span className="font-block text-[10px] uppercase text-cream/60">
        Colors
      </span>
      <ThemeColorPairFields
        label="Main"
        value={element.appearance?.main}
        defaults={DEFAULT_BUTTON_ELEMENT_APPEARANCE.main}
        onChange={(colors) => setButtonColor("main", colors)}
      />
      <ThemeColorPairFields
        label="Text"
        value={element.appearance?.text}
        defaults={DEFAULT_BUTTON_ELEMENT_APPEARANCE.text}
        onChange={(colors) => setButtonColor("text", colors)}
      />
      <ThemeColorPairFields
        label="Edge"
        value={element.appearance?.edge}
        defaults={DEFAULT_BUTTON_ELEMENT_APPEARANCE.edge}
        onChange={(colors) => setButtonColor("edge", colors)}
      />
    </div>
  );
}

function ThemeColorPairFields({
  label,
  value,
  defaults,
  onChange,
}: {
  label: string;
  value?: ThemeColorPair;
  defaults: ThemeColorPair;
  onChange: (value: ThemeColorPair | undefined) => void;
}) {
  const resolved = value ?? defaults;

  return (
    <div className="space-y-1 border border-cream/20 bg-charcoal/35 p-2">
      <div className="flex items-center justify-between">
        <span className={labelClass}>{label}</span>
        {value ? (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-[10px] text-cream/55 hover:text-cream"
          >
            Use defaults
          </button>
        ) : (
          <span className="text-[10px] text-cream/35">Default</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["light", "dark"] as const).map((mode) => (
          <label key={mode}>
            <span className={labelClass}>{mode}</span>
            <input
              type="color"
              value={resolved[mode]}
              onChange={(event) =>
                onChange({
                  ...resolved,
                  [mode]: event.target.value,
                })
              }
              className="h-8 w-full border border-cream/30 bg-charcoal p-1"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
