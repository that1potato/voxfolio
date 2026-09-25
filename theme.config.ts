export type SiteThemeMode = "light" | "dark";

/**
 * Shared site-wide theme selection.
 *
 * `activeMode` is the mode the site loads in (server-rendered on <html>). The
 * in-page theme switcher can change it for the current session; the article
 * and map theme scopes follow whichever mode is active.
 */
export const siteTheme = {
  activeMode: "light" as SiteThemeMode,
} as const;
