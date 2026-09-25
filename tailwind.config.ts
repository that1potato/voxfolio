import type { Config } from "tailwindcss";
import { palette } from "./site.config";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.{mdx,md}",
  ],
  theme: {
    extend: {
      // Shared UI palette — single source of truth in site.config.ts.
      colors: {
        ...palette,
      },
      fontFamily: {
        block: ["var(--font-block)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
