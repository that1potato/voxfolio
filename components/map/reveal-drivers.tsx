"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  terrainCameraProgress,
  terrainRevealProgress,
  TERRAIN_REVEAL_START_RADIUS,
  TERRAIN_REVEAL_DURATION_MS,
  type RadialRevealState,
  type RevealOrigin,
} from "@/lib/radial-reveal";
import { VoxelBackdrop } from "./VoxelBackdrop";
import type { SiteThemeMode } from "@/theme.config";
import type { Terrain as TerrainData } from "@/lib/terrains";
import type { GeneratedSurroundings } from "@/lib/surroundings/types";
import {
  getGridBounds,
  getRevealMaxRadius,
  type TerrainRevealTransition,
} from "./voxel-map-bounds";

/**
 * Frame-loop drivers and backdrop crossfade for `VoxelMap`'s reveal animations.
 * Each mutates a shared `RadialRevealState` ref and calls `invalidate()` so the
 * on-demand canvas keeps repainting until the animation settles.
 */

export function TerrainRevealDriver({
  onComplete,
  revealState,
  transition,
}: {
  onComplete: (key: number) => void;
  revealState: MutableRefObject<RadialRevealState>;
  transition: TerrainRevealTransition;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const startTime = useRef<number | null>(null);
  const completedKey = useRef<number | null>(null);

  useLayoutEffect(() => {
    startTime.current = null;
    completedKey.current = null;
    revealState.current.active = true;
    revealState.current.origin = transition.origin;
    revealState.current.radius = TERRAIN_REVEAL_START_RADIUS;
    revealState.current.progress = 0;
    invalidate();
  }, [invalidate, revealState, transition]);

  useFrame(() => {
    if (completedKey.current === transition.key) return;
    const now = performance.now();
    if (startTime.current === null) startTime.current = now;
    const elapsed = now - startTime.current;
    const rawProgress = Math.min(Math.max(elapsed / transition.durationMs, 0), 1);
    const revealProgress = terrainRevealProgress(rawProgress);

    revealState.current.active = true;
    revealState.current.origin = transition.origin;
    revealState.current.progress = terrainCameraProgress(rawProgress);
    revealState.current.radius =
      TERRAIN_REVEAL_START_RADIUS +
      revealProgress * (transition.maxRadius - TERRAIN_REVEAL_START_RADIUS);

    if (rawProgress >= 1) {
      completedKey.current = transition.key;
      revealState.current.radius = transition.maxRadius;
      revealState.current.progress = 1;
      onComplete(transition.key);
      return;
    }

    invalidate();
  });

  return null;
}

/**
 * Drives the one-time landing reveal for a single terrain — the swap version's
 * `TerrainRevealDriver` minus the from/to crossfade and camera lerp. Origin is
 * the terrain's centre, so the island blooms outward from the middle. Reused
 * reveal primitives mean the shader path is identical to a terrain swap.
 */
export function IntroRevealDriver({
  onComplete,
  revealState,
  surroundings,
  terrain,
}: {
  onComplete: () => void;
  revealState: MutableRefObject<RadialRevealState>;
  surroundings: GeneratedSurroundings | null;
  terrain: TerrainData;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const startTime = useRef<number | null>(null);
  const done = useRef(false);
  const config = useRef<{ origin: RevealOrigin; maxRadius: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    const bounds = getGridBounds(terrain.grid);
    const origin: RevealOrigin = [
      (bounds.minX + bounds.maxX) / 2,
      0,
      (bounds.minZ + bounds.maxZ) / 2,
    ];
    const maxRadius = getRevealMaxRadius(origin, [{ terrain, surroundings }], {
      width: typeof window === "undefined" ? 0 : window.innerWidth,
      height: typeof window === "undefined" ? 0 : window.innerHeight,
    });
    config.current = { origin, maxRadius };
    startTime.current = null;
    done.current = false;
    revealState.current.active = true;
    revealState.current.origin = origin;
    revealState.current.radius = TERRAIN_REVEAL_START_RADIUS;
    revealState.current.progress = 0;
    invalidate();
  }, [invalidate, revealState, surroundings, terrain]);

  useFrame(() => {
    const settings = config.current;
    if (done.current || !settings) return;
    const now = performance.now();
    if (startTime.current === null) startTime.current = now;
    const rawProgress = Math.min(
      Math.max((now - startTime.current) / TERRAIN_REVEAL_DURATION_MS, 0),
      1,
    );
    const revealProgress = terrainRevealProgress(rawProgress);

    revealState.current.active = true;
    revealState.current.origin = settings.origin;
    revealState.current.progress = rawProgress;
    revealState.current.radius =
      TERRAIN_REVEAL_START_RADIUS +
      revealProgress * (settings.maxRadius - TERRAIN_REVEAL_START_RADIUS);

    if (rawProgress >= 1) {
      done.current = true;
      revealState.current.radius = settings.maxRadius;
      revealState.current.active = false;
      onComplete();
      return;
    }

    invalidate();
  });

  return null;
}

export function VoxelBackdropStage({
  activeAtmosphere,
  showReadingSky,
  themeMode,
  transition,
}: {
  /** The active terrain's atmosphere preset id, if any. */
  activeAtmosphere?: string;
  showReadingSky: boolean;
  themeMode: SiteThemeMode;
  transition: TerrainRevealTransition | null;
}) {
  if (!transition) {
    return (
      <VoxelBackdrop
        themeMode={themeMode}
        atmosphere={activeAtmosphere}
        showReadingSky={showReadingSky}
      />
    );
  }

  return (
    <VoxelBackdropCrossfade
      key={transition.key}
      durationMs={transition.durationMs}
      fromAtmosphere={transition.fromTerrain.atmosphere}
      showReadingSky={showReadingSky}
      themeMode={themeMode}
      toAtmosphere={transition.toTerrain.atmosphere}
    />
  );
}

function VoxelBackdropCrossfade({
  durationMs,
  fromAtmosphere,
  showReadingSky,
  themeMode,
  toAtmosphere,
}: {
  durationMs: number;
  fromAtmosphere?: string;
  showReadingSky: boolean;
  themeMode: SiteThemeMode;
  toAtmosphere?: string;
}) {
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setRunning(false);
    const raf = requestAnimationFrame(() => setRunning(true));
    return () => cancelAnimationFrame(raf);
  }, [fromAtmosphere, toAtmosphere]);

  return (
    <>
      <VoxelBackdrop
        themeMode={themeMode}
        atmosphere={toAtmosphere}
        opacity={running ? 1 : 0}
        opacityTransitionMs={durationMs}
        showReadingSky={showReadingSky}
      />
      <VoxelBackdrop
        themeMode={themeMode}
        atmosphere={fromAtmosphere}
        opacity={running ? 0 : 1}
        opacityTransitionMs={durationMs}
        showReadingSky={showReadingSky}
      />
    </>
  );
}
