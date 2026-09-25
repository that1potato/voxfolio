import type { SiteThemeMode } from "@/theme.config";

export interface SceneLightingConfig {
  ambient: { color: string; intensity: number };
  hemisphere: { skyColor: string; groundColor: string; intensity: number };
  sun: { color: string; intensity: number };
  rim: { color: string; intensity: number; position: [number, number, number] };
  /** gl.toneMappingExposure — nudges overall brightness per mood */
  exposure: number;
}

export const sceneLighting: Record<SiteThemeMode, SceneLightingConfig> = {
  /** Warm golden-hour day: sun is amber-gold, sky fill is cool blue, ground bounce is earthy. */
  light: {
    ambient:    { color: "#fff0d8", intensity: 0.38 },
    hemisphere: { skyColor: "#b8d4ff", groundColor: "#c89060", intensity: 0.9 },
    sun:        { color: "#ffe0a0", intensity: 1.9 },
    rim:        { color: "#d4e8ff", intensity: 0.32, position: [-10, 8, -10] },
    exposure:   1.28,
  },

  /** Cool moonlight night: bright enough to read, silver-blue key, deep indigo sky. */
  dark: {
    ambient:    { color: "#36517c", intensity: 0.62 },
    hemisphere: { skyColor: "#4a68a0", groundColor: "#1d2b42", intensity: 0.92 },
    sun:        { color: "#d8e4ff", intensity: 1.35 },
    rim:        { color: "#6f90d0", intensity: 0.52, position: [-10, 8, -10] },
    exposure:   1.6,
  },
};
