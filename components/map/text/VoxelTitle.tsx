"use client";

import type {
  ElementOrientation,
  MapImageAttachment,
} from "@/lib/terrains";
import { levels } from "./typography";
import { VoxelTextElement } from "./VoxelTextElement";
import type { RadialRevealMask } from "@/lib/radial-reveal";

/**
 * The biggest, thickest voxel text — used for the site title.
 *
 * Ground orientation places the text grid on the XZ plane and turns `depth`
 * into raised height. Upright orientation keeps the text on the XY plane,
 * with its depth extending toward local +Z.
 *
 * `position` is the center of the text. For ground orientation, `position.y`
 * should equal the ground top so the raised letters sit on the platform.
 * `rotationY` rotates either orientation around the vertical axis.
 *
 * Tune the look globally by editing `levels.title` in ./typography.ts.
 */

interface Props {
  children: string;
  position: [number, number, number];
  rotationY?: number;
  orientation: ElementOrientation;
  /** Per-instance scale override (rare — prefer editing typography.ts). */
  scaleOverride?: number;
  /** Uniform element-level scale applied around the element origin. */
  elementScale?: number;
  image?: MapImageAttachment;
  color?: string;
  radialReveal?: RadialRevealMask;
}

export function VoxelTitle({
  children,
  position,
  rotationY = 0,
  orientation,
  scaleOverride,
  elementScale = 1,
  image,
  color = levels.title.color,
  radialReveal,
}: Props) {
  return (
    <VoxelTextElement
      position={position}
      rotationY={rotationY}
      orientation={orientation}
      scale={scaleOverride ?? levels.title.scale}
      depth={levels.title.depth}
      color={color}
      anchorX="center"
      anchorY="center"
      elementScale={elementScale}
      image={image}
      imageGap={0.5}
      radialReveal={radialReveal}
    >
      {children}
    </VoxelTextElement>
  );
}
