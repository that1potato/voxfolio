import { getAtmosphere } from "@/atmosphere.config";
import type { SiteThemeMode } from "@/theme.config";

/**
 * Water surface theming for the map's `WaterPlane`. Kept beside the other
 * map look-and-feel config files (`scene-lighting.config.ts`,
 * `voxel-backdrop.config.ts`) so all backdrop/water tuning lives in one place.
 */

export interface WaterColors {
  base: string;
  foam: string;
  horizon: string;
}

// `horizon` matches the CSS sky-bottom stop (voxel-backdrop.config.ts) so the
// far water dissolves into the same tone as the background gradient.
const WATER_COLORS: Record<SiteThemeMode, WaterColors> = {
  light: { base: "#6ea8c8", foam: "#f0f8ff", horizon: "#f1e7d6" },
  dark:  { base: "#152535", foam: "#8ab8c8", horizon: "#14110d" },
};

// A terrain's atmosphere preset (`atmosphere.config.ts`) replaces the water in
// both modes; its horizon matches the preset's sky-bottom so the far water
// dissolves into the same glow.
export function waterColorsFor(
  atmosphereId: string | undefined,
  mode: SiteThemeMode,
): WaterColors {
  return getAtmosphere(atmosphereId)?.water ?? WATER_COLORS[mode];
}
