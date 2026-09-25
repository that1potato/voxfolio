import type { CSSProperties } from "react";
import { getAtmosphere } from "@/atmosphere.config";
import { siteTheme, type SiteThemeMode } from "@/theme.config";

export interface VoxelBackdropVariant {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
}

export const voxelBackdropTheme = {
  activeMode: siteTheme.activeMode,
  colorTransitionMs: 800,
  variants: {
    light: {
      skyTop: "#aecadf",
      skyMid: "#d6e1e6",
      skyBottom: "#f1e7d6",
    },
    dark: {
      skyTop: "#0a0e16",
      skyMid: "#0f1014",
      skyBottom: "#14110d",
    },
  } satisfies Record<SiteThemeMode, VoxelBackdropVariant>,
} as const;

export type VoxelBackdropStyle = CSSProperties & {
  "--voxel-sky-top": string;
  "--voxel-sky-mid": string;
  "--voxel-sky-bottom": string;
  "--voxel-backdrop-color-duration": string;
};

/**
 * Sky colors for a mode, or for a terrain's atmosphere preset
 * (`atmosphere.config.ts`) — a preset's sky applies regardless of light/dark
 * mode so a terrain can carry its own mood.
 */
export function getVoxelBackdropVariant(
  mode: SiteThemeMode = voxelBackdropTheme.activeMode,
  atmosphereId?: string,
): VoxelBackdropVariant {
  return getAtmosphere(atmosphereId)?.sky ?? voxelBackdropTheme.variants[mode];
}

export function getVoxelBackdropStyle(
  mode: SiteThemeMode = voxelBackdropTheme.activeMode,
  atmosphereId?: string,
): VoxelBackdropStyle {
  const variant = getVoxelBackdropVariant(mode, atmosphereId);

  return {
    "--voxel-sky-top": variant.skyTop,
    "--voxel-sky-mid": variant.skyMid,
    "--voxel-sky-bottom": variant.skyBottom,
    "--voxel-backdrop-color-duration": `${voxelBackdropTheme.colorTransitionMs}ms`,
  };
}
