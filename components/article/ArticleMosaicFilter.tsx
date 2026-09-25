import { articleTheme } from "@/article.config";

/**
 * Hidden SVG <filter> that pixelates whatever it samples into chunky,
 * Minecraft-style mosaic blocks. Referenced from CSS via
 * `backdrop-filter: url(#article-mosaic)` on `.article-glass-backdrop`, so the
 * live 3D scene behind the reading panel reads as a pixel grid — like the
 * real-life mosaic-glass lens.
 *
 * Block size is driven by the single `articleTheme.mosaic.blockSize` knob:
 * flood one small sample dot per cell, tile it on a P×P grid, keep the source
 * only under the dots, then dilate each sample to fill its cell.
 *
 * Mounted once in the root layout so the `#article-mosaic` id resolves
 * document-wide (a single instance avoids duplicate-id collisions).
 */
export function ArticleMosaicFilter() {
  const p = articleTheme.mosaic.blockSize;
  // Center a 2px sample dot in each P×P cell, then dilate by half a cell so the
  // sampled colour fills the whole block.
  const dot = 2;
  const offset = (p - dot) / 2;
  const radius = p / 2;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
    >
      <defs>
        <filter
          id="article-mosaic"
          x="0"
          y="0"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feFlood
            x={offset}
            y={offset}
            width={dot}
            height={dot}
            floodColor="#000"
            floodOpacity="1"
          />
          <feComposite width={p} height={p} />
          <feTile result="grid" />
          <feComposite in="SourceGraphic" in2="grid" operator="in" />
          <feMorphology operator="dilate" radius={radius} />
        </filter>
      </defs>
    </svg>
  );
}
