"use client";

import type { ElementOrientation } from "@/lib/terrains";

const inputClass =
  "w-full border border-cream/30 bg-charcoal px-2 py-1 text-xs text-cream";
const labelClass = "block font-block text-[10px] uppercase text-cream/60";

interface Props {
  value: ElementOrientation;
  onChange: (orientation: ElementOrientation) => void;
}

export function OrientationField({ value, onChange }: Props) {
  return (
    <label>
      <span className={labelClass}>Orientation</span>
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value as ElementOrientation)
        }
        className={inputClass}
      >
        <option value="ground">Flat on ground</option>
        <option value="upright">Upright</option>
      </select>
    </label>
  );
}
