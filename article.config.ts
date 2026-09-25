import type { CSSProperties } from "react";
import { siteTheme, type SiteThemeMode } from "@/theme.config";

export type ArticleThemeMode = SiteThemeMode;

interface ArticleThemeVariant {
  colors: {
    fallbackSurface: string;
    surface: string;
    border: string;
    highlight: string;
    divider: string;
    text: string;
    mutedText: string;
    accent: string;
    accentHover: string;
    codeBackground: string;
    controlBackground: string;
    controlHoverBackground: string;
    cardBackground: string;
    cardHoverBackground: string;
    tagBackground: string;
  };
  effects: {
    /** Standard `backdrop-filter` — the mosaic-lens chain (SVG pixelate + tint). */
    backdropFilter: string;
    /** `-webkit-backdrop-filter` fallback (plain blur) for engines that don't
     * support SVG `url()` filters in backdrop-filter (Safari). */
    backdropFilterFallback: string;
    surfaceShadow: string;
  };
}

/**
 * Article-only visual configuration.
 *
 * Both variants are live: `activeMode` (from theme.config.ts) is the default,
 * and the in-page theme switcher flips the reading surface between light and
 * dark along with the map.
 */
export const articleTheme = {
  activeMode: siteTheme.activeMode,
  fonts: {
    body: "var(--font-fira-sans), var(--font-inter), system-ui, sans-serif",
    display:
      "var(--font-fira-code), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    title: "var(--font-fraunces), var(--font-fira-code), Georgia, serif",
    mono: "var(--font-fira-code), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  shape: {
    borderWidth: "1.3px",
    radius: "6px",
    cardRadius: "6px",
    controlRadius: "6px",
  },
  layout: {
    maxWidth: "64rem",
  },
  /**
   * Mosaic-glass lens. The reading panel's backdrop pixelates the live 3D scene
   * behind it into Minecraft-style blocks via the `#article-mosaic` SVG filter
   * (see components/article/ArticleMosaicFilter.tsx).
   *
   * `blockSize` is the chunkiness knob — bigger = chunkier blocks.
   * Roughly: chunky ≈ 18, default ≈ 12, fine ≈ 7 (CSS px).
   */
  mosaic: {
    blockSize: 23,
  },
  motion: {
    durationMs: 420,
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    offsetY: "12px",
    /** Spotlight-style blur-in: the cloud's start blur + convergence scale. */
    blur: "16px",
    scale: "1.06",
  },
  typography: {
    bodySize: "1rem",
    bodyLineHeight: "1.7",
    bodyWeight: "400",
    headingLetterSpacing: "-0.025em",
  },
  variants: {
    light: {
      colors: {
        fallbackSurface: "rgba(248, 246, 242, 0.97)",
        surface: "rgba(248, 246, 242, 0.75)",
        border: "rgba(255, 255, 255, 0.76)",
        highlight: "rgba(255, 255, 255, 0.52)",
        divider: "rgba(33, 30, 27, 0.12)",
        text: "#211e1b",
        mutedText: "rgba(33, 30, 27, 0.68)",
        accent: "#9d4316",
        accentHover: "#71300f",
        codeBackground: "rgba(255, 255, 255, 0.48)",
        controlBackground: "rgba(255, 255, 255, 0.42)",
        controlHoverBackground: "rgba(255, 255, 255, 0.72)",
        cardBackground: "rgba(255, 255, 255, 0.26)",
        cardHoverBackground: "rgba(255, 255, 255, 0.48)",
        tagBackground: "rgba(255, 255, 255, 0.36)",
      },
      effects: {
        backdropFilter: "url(#article-mosaic) blur(3px) saturate(140%) brightness(1.06)",
        backdropFilterFallback: "blur(20px) saturate(145%) brightness(1.08)",
        surfaceShadow:
          "0 24px 64px rgba(12, 9, 7, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.42)",
      },
    },
    dark: {
      colors: {
        fallbackSurface: "rgba(27, 24, 22, 0.97)",
        surface: "rgba(27, 24, 22, 0.60)",
        border: "rgba(255, 255, 255, 0.2)",
        highlight: "rgba(255, 255, 255, 0.12)",
        divider: "rgba(255, 255, 255, 0.12)",
        text: "#f7f3ee",
        mutedText: "rgba(247, 243, 238, 0.7)",
        accent: "#ff9a57",
        accentHover: "#ffc08f",
        codeBackground: "rgba(0, 0, 0, 0.28)",
        controlBackground: "rgba(255, 255, 255, 0.08)",
        controlHoverBackground: "rgba(255, 255, 255, 0.15)",
        cardBackground: "rgba(255, 255, 255, 0.055)",
        cardHoverBackground: "rgba(255, 255, 255, 0.1)",
        tagBackground: "rgba(255, 255, 255, 0.09)",
      },
      effects: {
        backdropFilter: "url(#article-mosaic) blur(3px) saturate(95%) brightness(0.84)",
        backdropFilterFallback: "blur(20px) saturate(90%) brightness(0.84)",
        surfaceShadow:
          "0 24px 72px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
      },
    },
  } satisfies Record<ArticleThemeMode, ArticleThemeVariant>,
} as const;

export type ArticleThemeStyle = CSSProperties & {
  [key: `--article-${string}`]: string;
};

export function getArticleThemeStyle(
  mode: ArticleThemeMode = articleTheme.activeMode,
): ArticleThemeStyle {
  const variant = articleTheme.variants[mode];

  return {
    "--article-font-body": articleTheme.fonts.body,
    "--article-font-display": articleTheme.fonts.display,
    "--article-font-title": articleTheme.fonts.title,
    "--article-font-mono": articleTheme.fonts.mono,
    "--article-read-measure": "44rem",
    "--article-fallback-surface": variant.colors.fallbackSurface,
    "--article-surface": variant.colors.surface,
    "--article-border": variant.colors.border,
    "--article-highlight": variant.colors.highlight,
    "--article-divider": variant.colors.divider,
    "--article-text": variant.colors.text,
    "--article-muted-text": variant.colors.mutedText,
    "--article-accent": variant.colors.accent,
    "--article-accent-hover": variant.colors.accentHover,
    "--article-code-background": variant.colors.codeBackground,
    "--article-control-background": variant.colors.controlBackground,
    "--article-control-hover-background":
      variant.colors.controlHoverBackground,
    "--article-card-background": variant.colors.cardBackground,
    "--article-card-hover-background": variant.colors.cardHoverBackground,
    "--article-tag-background": variant.colors.tagBackground,
    "--article-backdrop-filter": variant.effects.backdropFilter,
    "--article-backdrop-filter-fallback": variant.effects.backdropFilterFallback,
    "--article-surface-shadow": variant.effects.surfaceShadow,
    "--article-border-width": articleTheme.shape.borderWidth,
    "--article-radius": articleTheme.shape.radius,
    "--article-card-radius": articleTheme.shape.cardRadius,
    "--article-control-radius": articleTheme.shape.controlRadius,
    "--article-max-width": articleTheme.layout.maxWidth,
    "--article-motion-duration": `${articleTheme.motion.durationMs}ms`,
    "--article-motion-easing": articleTheme.motion.easing,
    "--article-motion-offset-y": articleTheme.motion.offsetY,
    "--article-motion-blur": articleTheme.motion.blur,
    "--article-motion-scale": articleTheme.motion.scale,
    "--article-body-size": articleTheme.typography.bodySize,
    "--article-body-line-height": articleTheme.typography.bodyLineHeight,
    "--article-body-weight": articleTheme.typography.bodyWeight,
    "--article-heading-letter-spacing":
      articleTheme.typography.headingLetterSpacing,
  };
}
