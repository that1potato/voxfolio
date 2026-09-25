"use client";

import { VoxelText3D } from "../VoxelText3D";
import { MapImagePlane } from "../MapImagePlane";
import type { ElementOrientation, MapImageAttachment } from "@/lib/terrains";
import {
  getAttachedContentLayout,
  getElementPlaneRotation,
} from "../element-layout";
import { measureVoxelText } from "./measure";
import type { RadialRevealMask } from "@/lib/radial-reveal";

/**
 * Shared presentational primitive behind `VoxelTitle` and `VoxelCaption`:
 * a voxel-text block on the element plane, optionally with an attached image.
 *
 * The outer group applies element placement (position / rotationY / scale);
 * the inner group tilts the text onto the ground or keeps it upright. Both
 * named wrappers feed it explicit style values from `levels` in ./typography.ts
 * — keep level lookups there, not here, so this stays level-agnostic.
 */

interface Props {
  children: string;
  position: [number, number, number];
  rotationY?: number;
  orientation: ElementOrientation;
  /** World units per font cube. */
  scale: number;
  /** Cube layers stacked along +Z. */
  depth: number;
  color: string;
  anchorX?: "left" | "center";
  anchorY: "center" | "baseline";
  /** Uniform element-level scale applied around the element origin. */
  elementScale?: number;
  image?: MapImageAttachment;
  /** Gap (world units) between the text and an attached image. */
  imageGap: number;
  radialReveal?: RadialRevealMask;
}

export function VoxelTextElement({
  children,
  position,
  rotationY = 0,
  orientation,
  scale,
  depth,
  color,
  anchorX = "center",
  anchorY,
  elementScale = 1,
  image,
  imageGap,
  radialReveal,
}: Props) {
  const textSize = measureVoxelText(children, scale);
  const layout = getAttachedContentLayout(
    textSize.width,
    textSize.height,
    image,
    imageGap,
  );
  // Baseline-anchored text grows upward from y=0, so its visual center sits at
  // +height/2; center-anchored text is already centered. Match the image to it.
  const imageY = anchorY === "baseline" ? textSize.height / 2 : 0;

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={elementScale}>
      <group rotation={getElementPlaneRotation(orientation)}>
        <VoxelText3D
          text={children}
          scale={scale}
          depth={depth}
          color={color}
          anchorX={anchorX}
          anchorY={anchorY}
          radialReveal={radialReveal}
        />
        {image && (
          <MapImagePlane
            src={image.src}
            alt={image.alt}
            position={[layout.imageX, imageY, 0.03]}
            orientation="upright"
            maxSize={image.size}
          />
        )}
      </group>
    </group>
  );
}
