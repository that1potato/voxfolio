export type SiteThemeMode = "light" | "dark";

/** What the visitor picked in the theme switcher; "system" follows the OS. */
export type ThemePreference = SiteThemeMode | "system";

/**
 * Shared site-wide theme selection.
 *
 * `defaultPreference` is what the in-page theme switcher starts on. "system"
 * resolves to the visitor's OS theme on the client and follows it live
 * (lib/use-system-theme.ts); the switcher can pin light or dark for the
 * current session. `activeMode` is the resolved fallback: the mode
 * server-rendered on <html>, used where matchMedia is unavailable, and the
 * editor preview's starting mode. The article and map theme scopes follow
 * whichever mode is active.
 */
export const siteTheme = {
  activeMode: "light" as SiteThemeMode,
  defaultPreference: "system" as ThemePreference,
} as const;
