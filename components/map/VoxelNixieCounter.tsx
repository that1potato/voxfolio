"use client";

import { useMemo } from "react";
import { DoubleSide } from "three";
import { VoxelText3D } from "./VoxelText3D";
import { getElementPlaneRotation } from "./element-layout";
import { levels } from "./text/typography";
import { useCounterValue } from "@/lib/use-counter-value";
import type { ElementOrientation } from "@/lib/terrains";
import type { RadialRevealMask } from "@/lib/radial-reveal";

/**
 * A number rendered as glowing Nixie-tube numerals — no housing, just the lit
 * amber digits (and an optional translucent tube tint behind each one). Shows
 * the static `value`; when an `endpoint` is set, its fetched count (via the
 * shared {@link useCounterValue} hook) replaces it once it arrives.
 *
 * Geometry matches VoxelText3D's 5×7 glyph grid: glyphs are 6 units apart at
 * scale 1, centered, so the per-digit tube panes line up with the digits.
 */

const GLYPH_PITCH = 6; // 5-wide glyph + 1 gap
const GLYPH_CENTER_COL = 2; // center column of a 5-wide glyph
const GLYPH_CENTER_Y = -0.5; // vertical center of a centered 7-row glyph

interface Props {
  position: [number, number, number];
  rotationY?: number;
  orientation: ElementOrientation;
  elementScale?: number;
  digits: number;
  /** Static number to display. Default 0. */
  value?: number;
  /** URL whose `{ "count": number }` JSON replaces `value` once fetched. */
  endpoint?: string;
  glowColor: string;
  glassColor?: string;
  radialReveal?: RadialRevealMask;
  /**
   * Scale applied by an ancestor group (the XR tabletop rig). The glow point
   * light's falloff is inverse-square over world metres, so its cutoff
   * distance scales linearly and its intensity quadratically or the counter
   * floods the whole 1/50-scale island with light.
   */
  worldScale?: number;
}

export function VoxelNixieCounter({
  position,
  rotationY = 0,
  orientation,
  elementScale = 1,
  digits,
  value,
  endpoint,
  glowColor,
  glassColor,
  radialReveal,
  worldScale = 1,
}: Props) {
  const fetched = useCounterValue(endpoint);
  const count = fetched ?? value ?? 0;

  const text = useMemo(() => {
    const shown = Math.max(0, Math.floor(count));
    return String(shown).padStart(digits, "0").slice(-digits);
  }, [count, digits]);

  const scale = levels.counter.scale;
  const lineWidth = text.length * GLYPH_PITCH - 1;
  const startX = -lineWidth / 2;

  // Per-digit tube centers in glyph-grid units (pre-scale).
  const tubeCenters = useMemo(
    () =>
      Array.from(
        { length: text.length },
        (_, i) => startX + i * GLYPH_PITCH + GLYPH_CENTER_COL,
      ),
    [text.length, startX],
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={elementScale}>
      <group rotation={getElementPlaneRotation(orientation)}>
        {/* Translucent tube panes behind the digits (optional). */}
        {glassColor && (
          <group scale={scale}>
            {tubeCenters.map((cx, i) => (
              <mesh key={i} position={[cx, GLYPH_CENTER_Y, -0.8]}>
                <boxGeometry args={[GLYPH_PITCH - 0.5, 9, 0.6]} />
                <meshStandardMaterial
                  color={glassColor}
                  transparent
                  opacity={0.55}
                  roughness={0.3}
                  metalness={0}
                  side={DoubleSide}
                />
              </mesh>
            ))}
          </group>
        )}

        <VoxelText3D
          text={text}
          scale={scale}
          depth={levels.counter.depth}
          color={glowColor}
          emissive={glowColor}
          emissiveIntensity={1.6}
          anchorX="center"
          anchorY="center"
          radialReveal={radialReveal}
        />

        {/* Warm bloom onto whatever sits behind the digits. */}
        <pointLight
          position={[0, 0, 2]}
          color={glowColor}
          intensity={6 * worldScale * worldScale}
          distance={12 * worldScale}
          decay={2}
        />
      </group>
    </group>
  );
}
