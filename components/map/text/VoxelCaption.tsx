"use client";

import type {
  ElementOrientation,
  MapImageAttachment,
} from "@/lib/terrains";
import { levels } from "./typography";
import { VoxelTextElement } from "./VoxelTextElement";
import type { RadialRevealMask } from "@/lib/radial-reveal";

/**
 * Smaller text for in-scene captions / hints / sub-labels.
 *
 * Tune the look globally by editing `levels.caption` in ./typography.ts.
 */

interface Props {
  children: string;
  position: [number, number, number];
  rotationY?: number;
  orientation: ElementOrientation;
  anchorX?: "left" | "center";
  /** Uniform element-level scale applied around the element origin. */
  elementScale?: number;
  image?: MapImageAttachment;
  color?: string;
  radialReveal?: RadialRevealMask;
}

export function VoxelCaption({
  children,
  position,
  rotationY = 0,
  orientation,
  anchorX = "center",
  elementScale = 1,
  image,
  color = levels.caption.color,
  radialReveal,
}: Props) {
  return (
    <VoxelTextElement
      position={position}
      rotationY={rotationY}
      orientation={orientation}
      scale={levels.caption.scale}
      depth={levels.caption.depth}
      color={color}
      anchorX={anchorX}
      anchorY="baseline"
      elementScale={elementScale}
      image={image}
      imageGap={0.25}
      radialReveal={radialReveal}
    >
      {children}
    </VoxelTextElement>
  );
}
