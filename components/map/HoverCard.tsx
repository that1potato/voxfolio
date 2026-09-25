"use client";

import type { Ref } from "react";
import { ArticleThemeScope } from "@/components/article/ArticleThemeScope";
import { ArticleGlassSurface } from "@/components/article/ArticleGlassSurface";
import type { HoverCardMeta } from "@/components/menu/overlay-types";
import type { SiteThemeMode } from "@/theme.config";

interface Props {
  meta: HoverCardMeta;
  themeMode?: SiteThemeMode;
  /** Drives the shared blur-in/out animation. */
  phase?: "enter" | "in" | "out";
  /** Which side of the button the card sits on. */
  side?: "right" | "left";
  rootRef?: Ref<HTMLDivElement>;
}

/**
 * Small frosted info card shown when hovering a button in the 3D scene; it
 * previews a list-section item (category, summary, tech tags). Reuses the
 * article reading-panel's mosaic-glass material + typography so it matches the
 * rest of the site. Rendered inside a drei <Html> overlay.
 *
 * The wrapper offsets the card beside the button so it never covers it; the
 * card itself shares the article panel's Spotlight-style blur-in/out keyframes
 * (the resting state carries no filter so the mosaic backdrop survives).
 */
export function HoverCard({
  meta,
  themeMode,
  phase = "enter",
  side = "right",
  rootRef,
}: Props) {
  return (
    <ArticleThemeScope
      mode={themeMode}
      className={[
        "hover-card-anchor",
        side === "left" ? "hover-card-left" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ArticleGlassSurface
        as="div"
        rootRef={rootRef}
        className={`hover-card hover-card-${phase}`}
      >
        {meta.category && <p className="article-eyebrow">{meta.category}</p>}
        {meta.summary && <p className="article-lede">{meta.summary}</p>}
        {meta.tech && meta.tech.length > 0 ? (
          <div className="article-meta-tags">
            {meta.tech.map((t) => (
              <span key={t} className="hover-card-tag">
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </ArticleGlassSurface>
    </ArticleThemeScope>
  );
}
