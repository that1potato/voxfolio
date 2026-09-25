"use client";

import { useMemo } from "react";
import { InstancedVoxels, type VoxelInstance } from "./InstancedVoxels";
import type { RadialRevealMask } from "@/lib/radial-reveal";

/**
 * Renders text as actual 3D voxel cubes inside the R3F scene. Acts as the
 * low-level primitive — for typical use cases (title, button labels,
 * captions) prefer the semantic wrappers in components/map/text/.
 *
 * Each glyph is a 5×7 bitmap; one "X" = one cube. Use \n for line breaks.
 * Supports uppercase A–Z, lowercase a–z, 0–9, space, dash, dot, comma,
 * slash, exclamation, and question marks. Unsupported characters render
 * as spaces.
 *
 * Anchoring:
 *   anchorX: "left" (default) → the leftmost cube of the widest line is at position.x.
 *            "center" → text is centered horizontally around position.x.
 *   anchorY: "baseline" (default) → the bottom row of cubes is at position.y.
 *            "center" → text is centered vertically around position.y.
 */

const G = (s: string) => s.split("\n").map((r) => r.replace(/ /g, ".").padEnd(5, "."));

const FONT: Record<string, string[]> = {
  A: G(".XXX.\nX...X\nX...X\nXXXXX\nX...X\nX...X\nX...X"),
  B: G("XXXX.\nX...X\nX...X\nXXXX.\nX...X\nX...X\nXXXX."),
  C: G(".XXXX\nX....\nX....\nX....\nX....\nX....\n.XXXX"),
  D: G("XXXX.\nX...X\nX...X\nX...X\nX...X\nX...X\nXXXX."),
  E: G("XXXXX\nX....\nX....\nXXXX.\nX....\nX....\nXXXXX"),
  F: G("XXXXX\nX....\nX....\nXXXX.\nX....\nX....\nX...."),
  G: G(".XXXX\nX....\nX....\nX..XX\nX...X\nX...X\n.XXX."),
  H: G("X...X\nX...X\nX...X\nXXXXX\nX...X\nX...X\nX...X"),
  I: G("XXXXX\n..X..\n..X..\n..X..\n..X..\n..X..\nXXXXX"),
  J: G("XXXXX\n....X\n....X\n....X\n....X\nX...X\n.XXX."),
  K: G("X...X\nX..X.\nX.X..\nXX...\nX.X..\nX..X.\nX...X"),
  L: G("X....\nX....\nX....\nX....\nX....\nX....\nXXXXX"),
  M: G("X...X\nXX.XX\nX.X.X\nX.X.X\nX...X\nX...X\nX...X"),
  N: G("X...X\nXX..X\nXX..X\nX.X.X\nX..XX\nX..XX\nX...X"),
  O: G(".XXX.\nX...X\nX...X\nX...X\nX...X\nX...X\n.XXX."),
  P: G("XXXX.\nX...X\nX...X\nXXXX.\nX....\nX....\nX...."),
  Q: G(".XXX.\nX...X\nX...X\nX...X\nX.X.X\nX..X.\n.XX.X"),
  R: G("XXXX.\nX...X\nX...X\nXXXX.\nX.X..\nX..X.\nX...X"),
  S: G(".XXXX\nX....\nX....\n.XXX.\n....X\n....X\nXXXX."),
  T: G("XXXXX\n..X..\n..X..\n..X..\n..X..\n..X..\n..X.."),
  U: G("X...X\nX...X\nX...X\nX...X\nX...X\nX...X\n.XXX."),
  V: G("X...X\nX...X\nX...X\nX...X\nX...X\n.X.X.\n..X.."),
  W: G("X...X\nX...X\nX...X\nX.X.X\nX.X.X\nXX.XX\nX...X"),
  X: G("X...X\nX...X\n.X.X.\n..X..\n.X.X.\nX...X\nX...X"),
  Y: G("X...X\nX...X\n.X.X.\n..X..\n..X..\n..X..\n..X.."),
  Z: G("XXXXX\n....X\n...X.\n..X..\n.X...\nX....\nXXXXX"),
  a: G(".....\n.....\n.XXX.\n....X\n.XXXX\nX...X\n.XXXX"),
  b: G("X....\nX....\nXXXX.\nX...X\nX...X\nX...X\nXXXX."),
  c: G(".....\n.....\n.XXXX\nX....\nX....\nX....\n.XXXX"),
  d: G("....X\n....X\n.XXXX\nX...X\nX...X\nX...X\n.XXXX"),
  e: G(".....\n.....\n.XXX.\nX...X\nXXXXX\nX....\n.XXXX"),
  f: G("..XX.\n.X..X\n.X...\nXXX..\n.X...\n.X...\n.X..."),
  g: G(".....\n.XXXX\nX...X\nX...X\n.XXXX\n....X\n.XXX."),
  h: G("X....\nX....\nXXXX.\nX...X\nX...X\nX...X\nX...X"),
  i: G("..X..\n.....\n.XX..\n..X..\n..X..\n..X..\n.XXX."),
  j: G("...X.\n.....\n..XX.\n...X.\n...X.\nX..X.\n.XX.."),
  k: G("X....\nX....\nX..X.\nX.X..\nXX...\nX.X..\nX..X."),
  l: G(".XX..\n..X..\n..X..\n..X..\n..X..\n..X..\n.XXX."),
  m: G(".....\n.....\nXX.X.\nX.X.X\nX.X.X\nX.X.X\nX.X.X"),
  n: G(".....\n.....\nXXXX.\nX...X\nX...X\nX...X\nX...X"),
  o: G(".....\n.....\n.XXX.\nX...X\nX...X\nX...X\n.XXX."),
  p: G(".....\nXXXX.\nX...X\nX...X\nXXXX.\nX....\nX...."),
  q: G(".....\n.XXXX\nX...X\nX...X\n.XXXX\n....X\n....X"),
  r: G(".....\n.....\nX.XX.\nXX..X\nX....\nX....\nX...."),
  s: G(".....\n.....\n.XXXX\nX....\n.XXX.\n....X\nXXXX."),
  t: G(".X...\n.X...\nXXX..\n.X...\n.X...\n.X..X\n..XX."),
  u: G(".....\n.....\nX...X\nX...X\nX...X\nX...X\n.XXXX"),
  v: G(".....\n.....\nX...X\nX...X\nX...X\n.X.X.\n..X.."),
  w: G(".....\n.....\nX...X\nX.X.X\nX.X.X\nX.X.X\n.X.X."),
  x: G(".....\n.....\nX...X\n.X.X.\n..X..\n.X.X.\nX...X"),
  y: G(".....\nX...X\nX...X\nX...X\n.XXXX\n....X\n.XXX."),
  z: G(".....\n.....\nXXXXX\n...X.\n..X..\n.X...\nXXXXX"),
  "0": G(".XXX.\nX...X\nX..XX\nX.X.X\nXX..X\nX...X\n.XXX."),
  "1": G("..X..\n.XX..\nX.X..\n..X..\n..X..\n..X..\nXXXXX"),
  "2": G(".XXX.\nX...X\n....X\n...X.\n..X..\n.X...\nXXXXX"),
  "3": G("XXXX.\n....X\n....X\n.XXX.\n....X\n....X\nXXXX."),
  "4": G("X..X.\nX..X.\nX..X.\nXXXXX\n...X.\n...X.\n...X."),
  "5": G("XXXXX\nX....\nXXXX.\n....X\n....X\nX...X\n.XXX."),
  "6": G(".XXX.\nX....\nX....\nXXXX.\nX...X\nX...X\n.XXX."),
  "7": G("XXXXX\n....X\n...X.\n..X..\n.X...\nX....\nX...."),
  "8": G(".XXX.\nX...X\nX...X\n.XXX.\nX...X\nX...X\n.XXX."),
  "9": G(".XXX.\nX...X\nX...X\n.XXXX\n....X\n....X\n.XXX."),
  ".": G(".....\n.....\n.....\n.....\n.....\n.....\n..XX."),
  ",": G(".....\n.....\n.....\n.....\n..XX.\n..XX.\n.XX.."),
  "-": G(".....\n.....\n.....\nXXXXX\n.....\n.....\n....."),
  "/": G("....X\n....X\n...X.\n..X..\n.X...\nX....\nX...."),
  "!": G("..X..\n..X..\n..X..\n..X..\n..X..\n.....\n..X.."),
  "?": G(".XXX.\nX...X\n....X\n...X.\n..X..\n.....\n..X.."),
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};

interface Props {
  text: string;
  position?: [number, number, number];
  scale?: number;
  color?: string;
  rotationY?: number;
  /** Number of cube layers along the text's +Z direction. Default 1. */
  depth?: number;
  /** Horizontal anchor for the text block. Default "left". */
  anchorX?: "left" | "center";
  /** Vertical anchor for the text block. Default "baseline" (bottom row at position.y). */
  anchorY?: "baseline" | "center";
  /** Emissive color to make the glyphs glow (e.g. Nixie digits). Default off. */
  emissive?: string;
  /** Emissive intensity; only meaningful when `emissive` is set. */
  emissiveIntensity?: number;
  radialReveal?: RadialRevealMask;
}

const LINE_HEIGHT = 8; // 7 row glyph + 1 row gap

export function VoxelText3D({
  text,
  position = [0, 0, 0],
  scale = 1,
  color = "cream",
  rotationY = 0,
  depth = 1,
  anchorX = "left",
  anchorY = "baseline",
  emissive,
  emissiveIntensity,
  radialReveal,
}: Props) {
  const cubes = useMemo(() => {
    const out: { pos: [number, number, number] }[] = [];
    const lines = text.split("\n");
    const totalHeight = lines.length * LINE_HEIGHT - 1; // last line has no gap below

    const yAnchorOffset = anchorY === "center" ? -totalHeight / 2 : 0;

    lines.forEach((line, lineIdx) => {
      // first line should be at the TOP, so it gets the highest baseY offset
      const baseY = (lines.length - 1 - lineIdx) * LINE_HEIGHT + yAnchorOffset;
      const lineW = line.length * 6 - 1;
      const startX = anchorX === "center" ? -lineW / 2 : 0;

      for (let i = 0; i < line.length; i++) {
        const glyph = FONT[line[i]] ?? FONT[" "];
        const cursorX = startX + i * 6;
        for (let row = 0; row < 7; row++) {
          const r = glyph[row];
          for (let col = 0; col < 5; col++) {
            if (r[col] === "X") {
              for (let d = 0; d < depth; d++) {
                out.push({ pos: [cursorX + col, baseY + (6 - row), d] });
              }
            }
          }
        }
      }
    });
    return out;
  }, [text, depth, anchorX, anchorY]);

  // One color per text block → one InstancedMesh (one draw call). The group
  // carries position/scale/rotation so the semantic wrappers' nested
  // transforms (VoxelTitle, VoxelButtonLabel) compose unchanged.
  const instances = useMemo<VoxelInstance[]>(
    () => cubes.map((c) => ({ position: c.pos, color })),
    [cubes, color],
  );

  return (
    <group position={position} scale={scale} rotation={[0, rotationY, 0]}>
      <InstancedVoxels
        instances={instances}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        radialReveal={radialReveal}
      />
    </group>
  );
}
