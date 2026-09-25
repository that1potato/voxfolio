"use client";

import { useEffect, useRef, useState } from "react";
import { Object3D, Vector3 } from "three";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { VoxelButtonLabel } from "./text/VoxelButtonLabel";
import { MapImagePlane } from "./MapImagePlane";
import { HoverCard } from "./HoverCard";
import type { HoverCardMeta } from "@/components/menu/overlay-types";
import type { SiteThemeMode } from "@/theme.config";
import { articleTheme } from "@/article.config";
import { palette } from "@/site.config";
import { FEATURED_BUTTON_FACE_COLOR } from "@/lib/map-element-appearance";
import type {
  ButtonContentMode,
  ElementOrientation,
  MapImageAttachment,
} from "@/lib/terrains";
import {
  BUTTON_DEFAULT_THICKNESS,
  getButtonContentLayout,
  getElementFacePosition,
  getElementPlaneRotation,
  getOrientedBoxDimensions,
} from "./element-layout";
import type { RadialRevealMask } from "@/lib/radial-reveal";

/**
 * A 3D voxel button rendered as either a ground panel or upright sign.
 * Font metrics are delegated to VoxelButtonLabel so this component doesn't
 * need to know anything about scale or letter widths.
 */

interface Props {
  label: string;
  position: [number, number, number];
  rotationY?: number;
  orientation: ElementOrientation;
  /** Box width (x-axis). Default 7. */
  width?: number;
  /** Face height: world Z when ground, world Y when upright. Default 2. */
  depth?: number;
  /** Panel thickness perpendicular to its face. Default 0.4. */
  thickness?: number;
  /** Persisted element-level scale. Hover/active scale only affects visuals. */
  scale?: number;
  onClick?: () => void;
  onPointerDown?: () => void;
  onPointerOver?: () => void;
  active?: boolean;
  /** Primary CTA — slightly different colour treatment. */
  featured?: boolean;
  image?: MapImageAttachment;
  contentMode?: ButtonContentMode;
  contentPadding?: number;
  interactionDisabled?: boolean;
  mainColor?: string;
  labelColor?: string;
  edgeColor?: string;
  /** When set, hovering shows a frosted info card above the button. */
  hoverCard?: HoverCardMeta;
  /** Suppress the DOM hover card (drei <Html> doesn't composite into XR). */
  suppressHoverCards?: boolean;
  themeMode?: SiteThemeMode;
  radialReveal?: RadialRevealMask;
}

/** World-space lift of the hover card's anchor above the button (local units). */
const CARD_LIFT = 1.5;
/** Card width (18rem) + horizontal gap (80px) in px — must match article.css. */
const CARD_WIDTH_PX = 18 * 16;
const CARD_GAP_PX = 80;
const CARD_EDGE_MARGIN_PX = 16;

export function VoxelButton3D({
  label,
  position,
  rotationY = 0,
  orientation,
  width = 7,
  depth = 2,
  thickness = BUTTON_DEFAULT_THICKNESS,
  scale = 1,
  onClick,
  onPointerDown,
  onPointerOver,
  active,
  featured,
  image,
  contentMode = "caption",
  contentPadding,
  interactionDisabled = false,
  mainColor = palette.brownDark,
  labelColor = palette.cream,
  edgeColor = palette.cream,
  hoverCard,
  suppressHoverCards = false,
  themeMode,
  radialReveal,
}: Props) {
  const [hover, setHover] = useState(false);
  const hi = hover || active;
  const invalidate = useThree((state) => state.invalidate);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  // Mount the hover card while hovered, and keep it mounted through the
  // exit animation so it can blur/scale out like the article panel.
  const wantCard =
    !interactionDisabled && !suppressHoverCards && hover && Boolean(hoverCard);
  const [cardMounted, setCardMounted] = useState(false);
  const [cardPhase, setCardPhase] = useState<"enter" | "in" | "out">("enter");
  // Which side of the button the card sits on — flips left when the right
  // side of the viewport doesn't have room.
  const [cardSide, setCardSide] = useState<"right" | "left">("right");
  const anchorRef = useRef<Object3D>(null);
  const cardRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wantCard) return;

    setCardMounted(true);
    setCardPhase("enter");
    const raf = requestAnimationFrame(() => {
      // Project the card anchor to screen space and pick a side that fits.
      if (anchorRef.current) {
        const ndc = anchorRef.current.getWorldPosition(new Vector3());
        ndc.project(camera);
        const screenX = (ndc.x * 0.5 + 0.5) * size.width;
        const span = CARD_GAP_PX + CARD_WIDTH_PX + CARD_EDGE_MARGIN_PX;
        const fitsRight = screenX + span <= size.width;
        const fitsLeft = screenX - span >= 0;
        setCardSide(!fitsRight && fitsLeft ? "left" : "right");
      }
      setCardPhase("in");
      invalidate();
    });
    return () => cancelAnimationFrame(raf);
  }, [wantCard, invalidate, camera, size.width]);

  useEffect(() => {
    if (wantCard || !cardMounted) return;

    let completed = false;
    setCardPhase("out");
    invalidate();

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = reduceMotion ? 0 : articleTheme.motion.durationMs;

    const completeExit = () => {
      if (completed) return;
      completed = true;
      setCardMounted(false);
      invalidate();
    };

    if (duration === 0) {
      completeExit();
      return;
    }

    const cardRoot = cardRootRef.current;
    const handleAnimationEnd = (event: AnimationEvent) => {
      if (
        event.target === cardRoot &&
        event.animationName === "article-glass-disperse"
      ) {
        completeExit();
      }
    };

    cardRoot?.addEventListener("animationend", handleAnimationEnd);
    const timer = window.setTimeout(completeExit, duration + 100);

    return () => {
      cardRoot?.removeEventListener("animationend", handleAnimationEnd);
      window.clearTimeout(timer);
    };
  }, [wantCard, cardMounted, invalidate]);

  useEffect(() => {
    if (interactionDisabled) {
      setHover(false);
      document.body.style.cursor = "";
    }
    return () => {
      document.body.style.cursor = "";
    };
  }, [interactionDisabled]);

  const resolvedFaceColor = featured ? FEATURED_BUTTON_FACE_COLOR : mainColor;

  const layout = getButtonContentLayout({
    width,
    height: depth,
    image,
    mode: contentMode,
    contentPadding,
  });
  const bodyDimensions = getOrientedBoxDimensions(
    orientation,
    width,
    depth,
    thickness,
  );
  const facePosition = getElementFacePosition(
    orientation,
    thickness / 2 + 0.02,
  );

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      scale={scale}
    >
      <object3D ref={anchorRef} position={[0, CARD_LIFT, 0]} />
      {cardMounted && hoverCard && (
        <Html
          position={[0, CARD_LIFT, 0]}
          zIndexRange={[40, 0]}
          style={{ pointerEvents: "none" }}
        >
          <HoverCard
            meta={hoverCard}
            themeMode={themeMode}
            phase={cardPhase}
            side={cardSide}
            rootRef={cardRootRef}
          />
        </Html>
      )}

      <mesh
        castShadow={false}
        receiveShadow={false}
        onClick={
          interactionDisabled
            ? undefined
            : (event) => {
                event.stopPropagation();
                onClick?.();
              }
        }
        onPointerDown={
          interactionDisabled || !onPointerDown
            ? undefined
            : (event) => {
                event.stopPropagation();
                onPointerDown();
              }
        }
        onPointerOver={
          interactionDisabled
            ? undefined
            : (event) => {
                event.stopPropagation();
                onPointerOver?.();
                setHover(true);
                document.body.style.cursor = "pointer";
                invalidate();
              }
        }
        onPointerOut={
          interactionDisabled
            ? undefined
            : () => {
                setHover(false);
                document.body.style.cursor = "";
                invalidate();
              }
        }
      >
        <boxGeometry args={bodyDimensions} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      <group scale={hi ? 1.05 : 1}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={bodyDimensions} />
          <meshStandardMaterial color={resolvedFaceColor} roughness={0.85} />
        </mesh>

        <group
          position={facePosition}
          rotation={getElementPlaneRotation(orientation)}
        >
          <ButtonFaceBorder width={width} height={depth} color={edgeColor} />
          {layout.showText && (
            <VoxelButtonLabel
              widthLimit={layout.labelWidth}
              heightLimit={layout.labelHeight}
              position={[layout.labelX, 0, 0]}
              color={labelColor}
              radialReveal={radialReveal}
            >
              {label}
            </VoxelButtonLabel>
          )}
          {layout.showImage && image && (
            <MapImagePlane
              src={image.src}
              alt={image.alt}
              position={[layout.imageX, 0, 0.01]}
              orientation="upright"
              maxSize={layout.imageSize}
            />
          )}
        </group>
      </group>
    </group>
  );
}

function ButtonFaceBorder({
  width,
  height,
  color,
}: {
  width: number;
  height: number;
  color: string;
}) {
  const rail = Math.min(0.12, Math.max(0.04, Math.min(width, height) * 0.06));
  const z = 0.055;
  const horizontalWidth = Math.max(0.01, width - rail);
  const verticalHeight = Math.max(0.01, height - rail);

  return (
    <group renderOrder={4}>
      <mesh
        position={[0, height / 2 - rail / 2, z]}
        castShadow={false}
        receiveShadow={false}
      >
        <boxGeometry args={[horizontalWidth, rail, rail]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <mesh
        position={[0, -height / 2 + rail / 2, z]}
        castShadow={false}
        receiveShadow={false}
      >
        <boxGeometry args={[horizontalWidth, rail, rail]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <mesh
        position={[-width / 2 + rail / 2, 0, z]}
        castShadow={false}
        receiveShadow={false}
      >
        <boxGeometry args={[rail, verticalHeight, rail]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <mesh
        position={[width / 2 - rail / 2, 0, z]}
        castShadow={false}
        receiveShadow={false}
      >
        <boxGeometry args={[rail, verticalHeight, rail]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
    </group>
  );
}
