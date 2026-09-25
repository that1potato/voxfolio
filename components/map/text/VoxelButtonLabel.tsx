"use client";

import { VoxelText3D } from "../VoxelText3D";
import { levels } from "./typography";
import { measureVoxelText } from "./measure";
import type { RadialRevealMask } from "@/lib/radial-reveal";

/**
 * Label rendered on a button face. Auto-fits its scale to the given
 * width/depth constraints so labels of varying lengths look balanced
 * without per-button tuning.
 *
 * Fully centered (X and Y) so the parent button can place this at its
 * face center without doing any math.
 *
 * Tune the look globally by editing `levels.buttonLabel` in ./typography.ts.
 */

interface Props {
  children: string;
  /** Max width (in world units) the label may occupy. */
  widthLimit: number;
  /** Max height (in world units) the label may occupy. */
  heightLimit: number;
  position?: [number, number, number];
  color?: string;
  radialReveal?: RadialRevealMask;
}

export function VoxelButtonLabel({
  children,
  widthLimit,
  heightLimit,
  position = [0, 0, 0],
  color = levels.buttonLabel.color,
  radialReveal,
}: Props) {
  const text = children;
  const { width: widthAt1, height: heightAt1 } = measureVoxelText(text, 1);

  const scaleByW = widthLimit / widthAt1;
  const scaleByH = heightLimit / heightAt1;
  const finalScale = Math.min(scaleByW, scaleByH, levels.buttonLabel.maxScale);

  return (
    <VoxelText3D
      text={text}
      position={position}
      scale={finalScale}
      depth={levels.buttonLabel.depth}
      color={color}
      anchorX="center"
      anchorY="center"
      radialReveal={radialReveal}
    />
  );
}
