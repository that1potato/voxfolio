import type { ThemeColorPair } from "@/lib/theme-colors";

/**
 * Atmosphere presets — optional per-terrain moods.
 *
 * A terrain opts in with `"atmosphere": "<id>"` in its JSON (or the editor's
 * Atmosphere picker). A preset replaces the CSS sky backdrop, the water
 * colors, and (when surroundings are regenerated) the decorative surroundings
 * palette — in BOTH light and dark mode, so the terrain always carries its
 * own mood. Terrains without an atmosphere use the default light/dark look
 * from `components/map/voxel-backdrop.config.ts` and `water.config.ts`.
 *
 * Add a preset by adding an entry below; it shows up in the editor picker.
 * Preset ids must be lowercase kebab-case (e.g. `golden-hour`) — the same rule
 * as terrain ids — or terrain validation rejects them (and the picker hides them).
 */

export interface AtmosphereSky {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
}

export interface AtmosphereWater {
  base: string;
  foam: string;
  /** Keep equal to `sky.skyBottom` so far water dissolves into the sky. */
  horizon: string;
}

export interface AtmospherePreset {
  /** Display name in the editor picker. */
  label: string;
  sky: AtmosphereSky;
  water: AtmosphereWater;
  /**
   * Palette for generated surroundings. Keys match the generator's palette in
   * `lib/surroundings/generate.ts`; missing keys fall back to its defaults.
   * Applied the next time surroundings are generated for the terrain.
   */
  surroundings?: Record<string, ThemeColorPair>;
}

export const atmospheres: Record<string, AtmospherePreset> = {
  // Deep night → plum → warm horizon glow, over indigo water, with a
  // moonlit teal isle and warm lantern-coloured trees.
  dusk: {
    label: "Dusk",
    sky: { skyTop: "#1d1733", skyMid: "#3b3772", skyBottom: "#c9785a" },
    water: { base: "#241d3a", foam: "#6a5a9c", horizon: "#c9785a" },
    surroundings: {
      "grass-edge": { light: "#5b7d84", dark: "#5b7d84" },
      "grass-mid": { light: "#496a72", dark: "#496a72" },
      grass: { light: "#3a5a62", dark: "#3a5a62" },
      cliff: { light: "#384654", dark: "#384654" },
      rock: { light: "#565169", dark: "#565169" },
      sand: { light: "#8a7a6c", dark: "#8a7a6c" },
      seabed: { light: "#20294a", dark: "#20294a" },
      trunk: { light: "#463748", dark: "#463748" },
      leaf: { light: "#2f504a", dark: "#2f504a" },
      blossom: { light: "#c9785a", dark: "#c9785a" },
      "blossom-light": { light: "#ffd887", dark: "#ffd887" },
      flower: { light: "#ffd887", dark: "#ffd887" },
    },
  },
};

/** Resolve a terrain's atmosphere id; unknown or missing ids return undefined. */
export function getAtmosphere(
  id: string | null | undefined,
): AtmospherePreset | undefined {
  if (!id || !Object.prototype.hasOwnProperty.call(atmospheres, id)) {
    return undefined;
  }
  return atmospheres[id];
}
