import type { SiteThemeMode } from "@/theme.config";

export interface ThemeColorPair {
  light: string;
  dark: string;
}

export function resolveThemeColor(
  colors: ThemeColorPair,
  mode: SiteThemeMode,
): string {
  return colors[mode];
}

export function darkenHexColor(color: string, amount = 0.25): string {
  const clampedAmount = Math.min(1, Math.max(0, amount));
  const channels = [1, 3, 5].map((offset) =>
    Number.parseInt(color.slice(offset, offset + 2), 16),
  );
  const darkened = channels.map((channel) =>
    Math.round(channel * (1 - clampedAmount))
      .toString(16)
      .padStart(2, "0"),
  );

  return `#${darkened.join("")}`;
}
