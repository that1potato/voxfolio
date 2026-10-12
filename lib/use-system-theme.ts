"use client";

import { useSyncExternalStore } from "react";
import { siteTheme, type SiteThemeMode } from "@/theme.config";

// The visitor's OS light/dark theme, tracked live: when the system flips while
// the page is open, the `change` event re-renders callers with the new mode.
//
// Browsers without matchMedia (and the server render) get
// `siteTheme.activeMode`. React hydrates with that and then re-renders with the
// real value, so there is no hydration mismatch.

const QUERY = "(prefers-color-scheme: dark)";

function supported(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

function subscribe(onChange: () => void): () => void {
  if (!supported()) return () => {};
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSnapshot(): SiteThemeMode {
  if (!supported()) return siteTheme.activeMode;
  return window.matchMedia(QUERY).matches ? "dark" : "light";
}

function getServerSnapshot(): SiteThemeMode {
  return siteTheme.activeMode;
}

export function useSystemTheme(): SiteThemeMode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
