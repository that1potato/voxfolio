import type { MutableRefObject } from "react";

export const TERRAIN_REVEAL_DURATION_MS = 1600;
export const TERRAIN_REVEAL_START_RADIUS = 1.75;
/** Radius slack past the farthest voxel so its trailing bloom completes by t=1. */
export const TERRAIN_REVEAL_RADIUS_PAD = 8;
/** Width (world units) of the soft band of mid-sprout voxels riding the wavefront. */
export const TERRAIN_REVEAL_BAND = 5;
/** How far (world units) a voxel emerges from below as it blooms in. */
export const TERRAIN_REVEAL_RISE = 1.5;
/** World-unit lag added to the wavefront per unit of column height (taller = later). */
export const TERRAIN_REVEAL_HEIGHT_DELAY = 2;

export type RadialRevealMode = "inside" | "outside";
export type RevealOrigin = [number, number, number];

export interface RadialRevealState {
  active: boolean;
  origin: RevealOrigin;
  radius: number;
  progress: number;
}

export interface RadialRevealMask {
  mode: RadialRevealMode;
  state: MutableRefObject<RadialRevealState>;
}

function clamp01(t: number): number {
  return Math.min(Math.max(t, 0), 1);
}

export function terrainRevealProgress(t: number): number {
  return Math.sin(clamp01(t) * Math.PI * 0.5);
}

export function terrainCameraProgress(t: number): number {
  const clamped = clamp01(t);
  return 0.5 - Math.cos(clamped * Math.PI) * 0.5;
}

export function radialRevealContains(
  origin: RevealOrigin,
  radius: number,
  position: RevealOrigin,
): boolean {
  const cellX = Math.floor(position[0]) + 0.5;
  const cellZ = Math.floor(position[2]) + 0.5;
  return Math.hypot(cellX - origin[0], cellZ - origin[2]) <= radius;
}

export function radialRevealVisible(
  mask: RadialRevealMask | undefined,
  position: RevealOrigin,
): boolean {
  if (!mask?.state.current.active) return true;
  const inside = radialRevealContains(
    mask.state.current.origin,
    mask.state.current.radius,
    position,
  );
  return mask.mode === "inside" ? inside : !inside;
}

/**
 * Eased 0→1 reveal factor for a whole element at `position` — the JS twin of the
 * per-voxel bloom in the InstancedVoxels vertex shader. 1 = fully present, 0 =
 * not yet arrived / already gone. Returns 1 when no reveal is active so normal
 * rendering is untouched.
 */
export function radialRevealFactor(
  mask: RadialRevealMask | undefined,
  position: RevealOrigin,
): number {
  const state = mask?.state.current;
  if (!mask || !state?.active) return 1;
  const cellX = Math.floor(position[0]) + 0.5;
  const cellZ = Math.floor(position[2]) + 0.5;
  const dist = Math.hypot(cellX - state.origin[0], cellZ - state.origin[2]);
  const signed =
    mask.mode === "inside" ? state.radius - dist : dist - state.radius;
  const local = clamp01(signed / TERRAIN_REVEAL_BAND);
  return local * local * (3 - 2 * local);
}
