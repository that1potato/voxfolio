"use client";

import { useMemo } from "react";
import { XRLayer as XRCompositionLayer } from "@react-three/xr";
import { Container, Image, Text, type FontFamilies } from "@react-three/uikit";
import { articleTheme } from "@/article.config";
import type { SiteThemeMode } from "@/theme.config";
import type {
  ArticleBlock,
  InlineSpan,
  ReadingContent,
  TableCell,
} from "@/components/menu/overlay-types";

/**
 * In-scene reading surface for immersive XR sessions. The desktop overlay
 * (components/menu/SectionOverlay.tsx) is DOM and does not composite into a
 * WebXR session, so the same content (as plain-data ReadingContent) is laid out
 * with @react-three/uikit: crisp MSDF text at any scale/distance, real images,
 * flexbox layout, and built-in ray-driven scrolling/hover — the closest match
 * to the flat site's reading mode a WebXR scene can host.
 *
 * Dynamically imported by VoxelMap and only mounted during an immersive
 * session, so uikit stays in its own async chunk out of the initial bundle.
 */

// The site's reading fonts as pre-generated MSDF atlases (see
// scripts/generate-msdf-fonts.sh): Fraunces 700 for titles, Fira Sans 400/600
// for body/UI, Fira Sans italic and Fira Code for inline emphasis/code —
// matching articleTheme.fonts. uikit has no fontStyle, so italic is its own
// family.
const FONT_FAMILIES: FontFamilies = {
  fraunces: { bold: "/fonts/msdf/fraunces-700.json" },
  "fira-sans": {
    normal: "/fonts/msdf/fira-sans-400.json",
    "semi-bold": "/fonts/msdf/fira-sans-600.json",
  },
  "fira-sans-italic": { normal: "/fonts/msdf/fira-sans-400-italic.json" },
  "fira-code": { normal: "/fonts/msdf/fira-code-400.json" },
};

// Layout is designed in px on a fixed-width surface; pixelSize maps it onto the
// requested physical panel width, so the type scale stays proportional.
const PANEL_PX_WIDTH = 900;

// Body text metrics shared by the single-Text fast path and the word-level
// rich-text path, so wrapped lines land at the same pitch either way. Absolute
// px strings — uikit reads a bare number as a multiplier of fontSize.
const BODY_FONT_SIZE = 16;
const BODY_LINE_HEIGHT = "26px" as const; // ≈165% of 16, in design px
const TABLE_LINE_HEIGHT = "21px" as const;
// Gap standing in for the space character between word-level Texts (≈ the
// Fira Sans space advance at 16px).
const WORD_GAP = 4.5;

/** uikit color value: either a plain CSS color string or an RGBA tuple. */
type UIColor = string | [number, number, number, number];

/** Convert a CSS color token from article.config.ts into a uikit color.
 *  `rgba()` tokens become RGBA tuples (uikit's Vector4Tuple form carries the
 *  alpha); everything else passes through for three.Color to parse. */
function toUIColor(token: string): UIColor {
  const m =
    /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(token);
  if (!m) return token;
  return [
    Number(m[1]) / 255,
    Number(m[2]) / 255,
    Number(m[3]) / 255,
    Number.parseFloat(m[4]),
  ];
}

interface Props {
  content: ReadingContent;
  themeMode: SiteThemeMode;
  isAR: boolean;
  /** Panel centre in the rig's local space (metres). */
  position: [number, number, number];
  width: number;
  height: number;
  onClose?: () => void;
  onSelectItem?: (slug: string) => void;
  onBack?: () => void;
}

// The panel is rendered into a WebXR composition layer: the compositor samples
// the layer's texture directly at display resolution instead of the text being
// resampled through the (lower-res, reprojected) eye buffer — the same
// mechanism that keeps system UI sharp. LAYER_RES oversamples the design-px
// layout for the render target; the compositor downsamples cleanly.
const LAYER_RES = 2;
// @react-three/xr's layer scene uses a fixed PerspectiveCamera (fov 50, z=5);
// content at z=0 spanning this height exactly fills the render target.
const LAYER_VIEW_HEIGHT = 2 * 5 * Math.tan((50 / 2) * (Math.PI / 180));

export function XRArticlePanel({
  content,
  themeMode,
  isAR,
  position,
  width,
  height,
  onClose,
  onSelectItem,
  onBack,
}: Props) {
  const pxHeight = Math.round(PANEL_PX_WIDTH * (height / width));
  return (
    <XRCompositionLayer
      shape="quad"
      quality="text-optimized"
      blendTextureSourceAlpha
      position={position}
      scale={[width, height, 1]}
      pixelWidth={PANEL_PX_WIDTH * LAYER_RES}
      pixelHeight={pxHeight * LAYER_RES}
      dpr={1}
    >
      <XRArticlePanelSurface
        content={content}
        themeMode={themeMode}
        isAR={isAR}
        pixelSize={LAYER_VIEW_HEIGHT / pxHeight}
        pxHeight={pxHeight}
        onClose={onClose}
        onSelectItem={onSelectItem}
        onBack={onBack}
      />
    </XRCompositionLayer>
  );
}

interface SurfaceProps {
  content: ReadingContent;
  themeMode: SiteThemeMode;
  isAR: boolean;
  /** Metres (or layer-scene units) per design px. */
  pixelSize: number;
  /** Panel height in design px (width is always PANEL_PX_WIDTH). */
  pxHeight: number;
  onClose?: () => void;
  onSelectItem?: (slug: string) => void;
  onBack?: () => void;
}

/** The pure uikit reading surface, centred on the local origin. Rendered into
 *  the composition layer above (in sessions) or straight into a Canvas (the
 *  /dev/xr-panel harness). */
export function XRArticlePanelSurface({
  content,
  themeMode,
  isAR,
  pixelSize,
  pxHeight,
  onClose,
  onSelectItem,
  onBack,
}: SurfaceProps) {
  const colors = articleTheme.variants[themeMode].colors;

  // AR passthrough shows the (bright) room through the panel, so lean on the
  // near-opaque fallback surface there; VR gets the translucent frosted look.
  const surface = toUIColor(isAR ? colors.fallbackSurface : colors.surface);
  const border = toUIColor(colors.border);
  const control = toUIColor(colors.controlBackground);
  const controlHover = toUIColor(colors.controlHoverBackground);
  const card = toUIColor(colors.cardBackground);
  const cardHover = toUIColor(colors.cardHoverBackground);
  const divider = toUIColor(colors.divider);
  const mutedText = toUIColor(colors.mutedText);

  // Remount the scroll container (→ scroll position resets to the top) whenever
  // the shown content changes.
  const contentKey = useMemo(
    () =>
      content.kind === "article"
        ? `a:${content.title}`
        : `l:${content.title}:${content.groups.reduce(
            (n, g) => n + g.items.length,
            0,
          )}`,
    [content],
  );

  const chromeButton = (label: string, onClick?: () => void) => (
    <Container
      paddingX={20}
      paddingY={10}
      borderRadius={999}
      backgroundColor={control}
      borderWidth={1}
      borderColor={border}
      hover={{ backgroundColor: controlHover }}
      cursor="pointer"
      onClick={onClick}
    >
      <Text
        fontFamily="fira-sans"
        fontWeight="semi-bold"
        fontSize={15}
        color={colors.text}
      >
        {label}
      </Text>
    </Container>
  );

  /**
   * Inline-styled text. uikit's Text takes one plain string (no nested styled
   * spans), so styled runs are laid out as word-level Texts inside a wrapping
   * row — whitespace becomes columnGap, and pieces not separated by whitespace
   * (e.g. `code` followed by a period) stay glued in one chunk so punctuation
   * never drifts. Every piece shares the block's lineHeight, so wrapped rows
   * stack at the same pitch as plain single-Text paragraphs.
   */
  const renderRichText = (
    spans: InlineSpan[],
    opts: { fontSize: number; lineHeight: `${number}px`; color: UIColor },
  ) => {
    type Piece = { text: string; span: InlineSpan };
    const chunks: Piece[][] = [];
    let current: Piece[] = [];
    for (const span of spans) {
      // A code span stays whole — one continuous chip like the desktop's
      // inline <code>, never one chip per word.
      const parts = span.code ? [span.text] : span.text.split(/(\s+)/);
      for (const part of parts) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          if (current.length) {
            chunks.push(current);
            current = [];
          }
        } else {
          current.push({ text: part, span });
        }
      }
    }
    if (current.length) chunks.push(current);

    const pieceText = ({ text, span }: Piece, key: number) =>
      span.code ? (
        <Text
          key={key}
          fontFamily="fira-code"
          fontSize={opts.fontSize - 2}
          lineHeight={opts.lineHeight}
          color={colors.text}
          backgroundColor={toUIColor(colors.codeBackground)}
          borderRadius={5}
          borderWidth={1}
          borderColor={divider}
          paddingX={5}
        >
          {text}
        </Text>
      ) : (
        <Text
          key={key}
          fontFamily={span.italic ? "fira-sans-italic" : "fira-sans"}
          fontWeight={span.bold || span.href ? "semi-bold" : "normal"}
          fontSize={opts.fontSize}
          lineHeight={opts.lineHeight}
          color={span.href ? colors.accent : opts.color}
        >
          {text}
        </Text>
      );

    return (
      <Container
        flexDirection="row"
        flexWrap="wrap"
        gapColumn={WORD_GAP}
        alignItems="flex-start"
      >
        {chunks.map((chunk, ci) =>
          chunk.length === 1 ? (
            pieceText(chunk[0], ci)
          ) : (
            <Container key={ci} flexDirection="row" alignItems="flex-start">
              {chunk.map(pieceText)}
            </Container>
          ),
        )}
      </Container>
    );
  };

  const renderCell = (cell: TableCell, header: boolean, key: number) => (
    <Container
      key={key}
      flexGrow={1}
      flexBasis={0}
      paddingX={12}
      paddingY={9}
    >
      {cell.spans ? (
        renderRichText(cell.spans, {
          fontSize: 14,
          lineHeight: TABLE_LINE_HEIGHT,
          color: header ? colors.text : mutedText,
        })
      ) : (
        <Text
          fontFamily="fira-sans"
          fontWeight={header ? "semi-bold" : "normal"}
          fontSize={14}
          lineHeight={TABLE_LINE_HEIGHT}
          color={header ? colors.text : mutedText}
        >
          {cell.text}
        </Text>
      )}
    </Container>
  );

  const renderBlock = (block: ArticleBlock, index: number) => {
    switch (block.type) {
      case "heading": {
        const size = block.level === 1 ? 27 : block.level === 2 ? 22 : 18;
        return (
          <Text
            key={index}
            fontFamily="fraunces"
            fontWeight="bold"
            fontSize={size}
            lineHeight="120%"
            color={colors.text}
            marginTop={block.level === 1 ? 18 : 14}
            marginBottom={4}
          >
            {block.text}
          </Text>
        );
      }
      case "listItem":
        return (
          <Container key={index} flexDirection="row" gap={10} marginBottom={7}>
            <Text
              fontFamily="fira-sans"
              fontWeight={block.marker ? "semi-bold" : "normal"}
              fontSize={BODY_FONT_SIZE}
              lineHeight={BODY_LINE_HEIGHT}
              color={colors.accent}
              width={block.marker ? 24 : undefined}
              textAlign={block.marker ? "right" : undefined}
            >
              {block.marker ?? "•"}
            </Text>
            <Container flexDirection="column" flexShrink={1} flexGrow={1}>
              {block.spans ? (
                renderRichText(block.spans, {
                  fontSize: BODY_FONT_SIZE,
                  lineHeight: BODY_LINE_HEIGHT,
                  color: colors.text,
                })
              ) : (
                <Text
                  fontFamily="fira-sans"
                  fontSize={BODY_FONT_SIZE}
                  lineHeight={BODY_LINE_HEIGHT}
                  color={colors.text}
                >
                  {block.text}
                </Text>
              )}
            </Container>
          </Container>
        );
      case "image":
        return (
          <Container
            key={index}
            flexDirection="column"
            alignItems="center"
            gap={8}
            marginTop={6}
            marginBottom={14}
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text -- uikit's 3D Image, not an HTML img */}
            <Image
              src={block.src}
              width="86%"
              maxHeight={520}
              borderRadius={10}
              borderWidth={1}
              borderColor={divider}
            />
            {block.caption && (
              <Text
                fontFamily="fira-sans"
                fontSize={13}
                lineHeight="150%"
                color={mutedText}
                textAlign="center"
              >
                {block.caption}
              </Text>
            )}
          </Container>
        );
      case "table":
        return (
          <Container
            key={index}
            flexDirection="column"
            width="100%"
            marginTop={6}
            marginBottom={14}
            borderWidth={1}
            borderColor={divider}
            borderRadius={8}
            overflow="hidden"
          >
            <Container
              flexDirection="row"
              backgroundColor={toUIColor(colors.tagBackground)}
            >
              {block.header.map((cell, ci) => renderCell(cell, true, ci))}
            </Container>
            {block.rows.map((row, ri) => (
              <Container
                key={ri}
                flexDirection="row"
                borderTopWidth={1}
                borderColor={divider}
              >
                {row.map((cell, ci) => renderCell(cell, false, ci))}
              </Container>
            ))}
          </Container>
        );
      case "embed":
        // No iframes inside WebGL — a visual stand-in card (poster + play
        // glyph); the video itself lives on the flat site.
        return (
          <Container
            key={index}
            flexDirection="column"
            alignItems="center"
            gap={8}
            marginTop={6}
            marginBottom={14}
          >
            <Container
              width="86%"
              borderRadius={10}
              borderWidth={1}
              borderColor={divider}
              overflow="hidden"
            >
              {/* eslint-disable-next-line jsx-a11y/alt-text -- uikit's 3D Image */}
              <Image
                src={`https://i.ytimg.com/vi/${block.id}/hqdefault.jpg`}
                width="100%"
              />
              <Container
                positionType="absolute"
                inset={0}
                alignItems="center"
                justifyContent="center"
              >
                <Container
                  backgroundColor={[0, 0, 0, 0.55]}
                  borderRadius={999}
                  paddingX={16}
                  paddingY={9}
                >
                  <Text fontFamily="fira-sans" fontSize={18} color="#ffffff">
                    ▶
                  </Text>
                </Container>
              </Container>
            </Container>
            <Text
              fontFamily="fira-sans"
              fontSize={13}
              lineHeight="150%"
              color={mutedText}
              textAlign="center"
            >
              {block.title ? `${block.title} — ` : ""}video, watch on the flat
              site
            </Text>
          </Container>
        );
      default:
        return block.spans ? (
          <Container key={index} flexDirection="column" marginBottom={12}>
            {renderRichText(block.spans, {
              fontSize: BODY_FONT_SIZE,
              lineHeight: BODY_LINE_HEIGHT,
              color: colors.text,
            })}
          </Container>
        ) : (
          <Text
            key={index}
            fontFamily="fira-sans"
            fontSize={BODY_FONT_SIZE}
            lineHeight={BODY_LINE_HEIGHT}
            color={colors.text}
            marginBottom={12}
          >
            {block.text}
          </Text>
        );
    }
  };

  return (
    <group>
      <Container
        pixelSize={pixelSize}
        width={PANEL_PX_WIDTH}
        height={pxHeight}
        flexDirection="column"
        backgroundColor={surface}
        borderRadius={26}
        borderWidth={1.5}
        borderColor={border}
        borderBend={0.4}
        fontFamilies={FONT_FAMILIES}
      >
        {/* Fixed chrome: Back (drilled into a list item) / Close. */}
        <Container
          flexDirection="row"
          justifyContent="space-between"
          paddingX={20}
          paddingTop={18}
          paddingBottom={10}
        >
          <Container>{onBack && chromeButton("‹ Back", onBack)}</Container>
          {chromeButton("Close", onClose)}
        </Container>

        {/* Scrollable reading surface. */}
        <Container
          key={contentKey}
          flexGrow={1}
          flexBasis={0}
          flexDirection="column"
          overflow="scroll"
          scrollbarColor={mutedText}
          scrollbarWidth={5}
          scrollbarBorderRadius={3}
        >
          {/* uikit uses yoga's web defaults, so children of the fixed-height
              scroll container default to flexShrink=1 — and a wrapping Text
              reports a one-line minHeight, letting yoga crush multi-line
              paragraphs (text then paints over the next block, and with
              everything "fitting", maxScrollY stays 0 so nothing scrolls).
              One non-shrinking column wrapper keeps the content height honest.
              The padding lives here rather than on the scroll container to
              avoid uikit adding the scroll container's paddingLeft to its
              scroll height. */}
          <Container
            flexDirection="column"
            flexShrink={0}
            width="100%"
            paddingX={34}
            paddingBottom={30}
          >
          {content.kind === "article" ? (
            <>
              {content.eyebrow && (
                <Text
                  fontFamily="fira-sans"
                  fontWeight="semi-bold"
                  fontSize={13}
                  letterSpacing={1.6}
                  color={colors.accent}
                  marginBottom={8}
                >
                  {content.eyebrow.toUpperCase()}
                </Text>
              )}
              <Text
                fontFamily="fraunces"
                fontWeight="bold"
                fontSize={38}
                lineHeight="112%"
                color={colors.text}
                marginBottom={10}
              >
                {content.title}
              </Text>
              {content.lede && (
                <Text
                  fontFamily="fira-sans"
                  fontSize={18}
                  lineHeight="150%"
                  color={mutedText}
                  marginBottom={14}
                >
                  {content.lede}
                </Text>
              )}
              <Container
                height={1.5}
                backgroundColor={divider}
                marginBottom={18}
              />
              {content.blocks.map(renderBlock)}
            </>
          ) : (
            <>
              <Text
                fontFamily="fraunces"
                fontWeight="bold"
                fontSize={38}
                lineHeight="112%"
                color={colors.text}
                marginBottom={18}
              >
                {content.title}
              </Text>
              {content.groups.map((group) => (
                <Container
                  key={group.category}
                  flexDirection="column"
                  marginBottom={18}
                >
                  <Text
                    fontFamily="fira-sans"
                    fontWeight="semi-bold"
                    fontSize={13}
                    letterSpacing={1.4}
                    color={mutedText}
                    marginBottom={10}
                  >
                    {group.category.toUpperCase()}
                  </Text>
                  <Container flexDirection="column" gap={10}>
                    {group.items.map((item) => (
                      <Container
                        key={item.slug}
                        flexDirection="column"
                        gap={4}
                        padding={16}
                        borderRadius={12}
                        backgroundColor={card}
                        hover={{ backgroundColor: cardHover }}
                        cursor="pointer"
                        onClick={() => onSelectItem?.(item.slug)}
                      >
                        <Text
                          fontFamily="fira-sans"
                          fontWeight="semi-bold"
                          fontSize={17}
                          color={colors.text}
                        >
                          {item.title}
                        </Text>
                        {item.summary && (
                          <Text
                            fontFamily="fira-sans"
                            fontSize={14}
                            lineHeight="150%"
                            color={mutedText}
                          >
                            {item.summary}
                          </Text>
                        )}
                      </Container>
                    ))}
                  </Container>
                </Container>
              ))}
            </>
          )}
          </Container>
        </Container>
      </Container>
    </group>
  );
}
