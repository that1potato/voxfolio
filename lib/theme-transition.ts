import { Color } from "three";

/**
 * Shared timing constant for theme light↔dark cross-fades in the WebGL scene.
 *
 * Tuned to match the CSS backdrop's 800 ms ease transition (voxel-backdrop.config.ts
 * `colorTransitionMs: 800`). The damped exponential `1 - exp(-k*t)` reaches ~98% at
 * t = 4/k; k=5 → ~0.8 s.
 */
export const THEME_DAMPING = 5;

/** Target blend values per mode — 0 = light, 1 = dark. */
export const THEME_BLEND: Record<string, number> = {
  light: 0,
  dark: 1,
};

/**
 * Advance a mutable blend scalar toward its target using frame-rate-independent
 * exponential damping (same formula as AmbientCamera's camera lerp).
 *
 * @param blend   The current blend value (mutated in place via the ref pattern —
 *                caller passes an object like `blendRef.current` or a plain wrapper).
 * @param target  Desired value (0 or 1).
 * @param delta   Frame delta from `useFrame`.
 * @returns `true` when the blend is settled (within epsilon of target).
 */
export function advanceBlend(
  state: { value: number },
  target: number,
  delta: number,
): boolean {
  const alpha = 1 - Math.exp(-THEME_DAMPING * delta);
  state.value += (target - state.value) * alpha;
  const settled = Math.abs(target - state.value) < 0.001;
  if (settled) state.value = target;
  return settled;
}

// Scratch Color objects — reused per frame to avoid GC pressure.
const _a = new Color();
const _b = new Color();

/**
 * Lerp two hex color strings by `t` (0=a, 1=b), writing the result into `target`.
 */
export function lerpHexColors(
  hexA: string,
  hexB: string,
  t: number,
  target: Color,
): Color {
  _a.set(hexA);
  _b.set(hexB);
  target.lerpColors(_a, _b, t);
  return target;
}
