"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import { BackSide, Color, ShaderMaterial } from "three";
import { XR, useXR, IfInSessionMode } from "@react-three/xr";
import { xrStore } from "@/lib/xr-store";
import { getVoxelBackdropVariant } from "./voxel-backdrop.config";
import type { SiteThemeMode } from "@/theme.config";

interface Props {
  children: ReactNode;
  themeMode: SiteThemeMode;
  /** Active terrain's atmosphere preset id; tints the VR sky like the CSS backdrop. */
  atmosphere?: string;
  /** Reports the active immersive session mode (or null) up to VoxelMap. */
  onModeChange: (mode: XRSessionMode | null) => void;
}

/**
 * In-Canvas WebXR wrapper. Dynamically imported by VoxelMap (so `@react-three/xr`
 * lands in its own chunk) and always mounted.
 *
 * It wraps the existing scene in <XR> — which is inert until a session starts
 * (it only takes over the camera once `session` flips non-null, see xr.js) — and
 * adds three session-aware helpers: a reporter that lifts the mode to VoxelMap,
 * a frameloop bridge, and a VR-only gradient backdrop for the immersive void.
 */
export default function XRLayer({
  children,
  themeMode,
  atmosphere,
  onModeChange,
}: Props) {
  return (
    <XR store={xrStore}>
      <KickRender />
      <SessionReporter onModeChange={onModeChange} />
      <SessionFrameloop />
      <IfInSessionMode allow="immersive-vr">
        <VRBackdrop themeMode={themeMode} atmosphere={atmosphere} />
      </IfInSessionMode>
      {children}
    </XR>
  );
}

/**
 * This layer is dynamically imported, so the scene it wraps mounts *after* the
 * Canvas's initial paint. Under frameloop="demand" that late mount renders
 * nothing until something invalidates, so kick a few frames on mount — enough
 * for AmbientCamera to fit/snap and the instanced voxels to draw, after which
 * the intro reveal sustains its own frames.
 */
function KickRender() {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    let raf = 0;
    let frame = 0;
    const tick = () => {
      invalidate();
      if (++frame < 5) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [invalidate]);
  return null;
}

function SessionReporter({
  onModeChange,
}: {
  onModeChange: (mode: XRSessionMode | null) => void;
}) {
  const mode = useXR((state) => state.mode);
  useEffect(() => {
    onModeChange(mode);
  }, [mode, onModeChange]);
  return null;
}

/**
 * The scene normally renders on demand (AmbientCamera is the only continuous
 * pump). An active session drives rendering through the headset's animation
 * loop, but we flip to "always" while presenting as insurance and kick one
 * frame on exit so the desktop camera re-settles under frameloop="demand".
 */
function SessionFrameloop() {
  const session = useXR((state) => state.session);
  const setFrameloop = useThree((state) => state.setFrameloop);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (session == null) return;
    setFrameloop("always");
    return () => {
      setFrameloop("demand");
      invalidate();
    };
  }, [session, setFrameloop, invalidate]);
  return null;
}

const VR_SKY_RADIUS = 60;

/**
 * Large inverted sphere giving the immersive-VR void a themed gradient sky —
 * the same mode/atmosphere colors as the desktop CSS backdrop.
 */
function VRBackdrop({
  themeMode,
  atmosphere,
}: {
  themeMode: SiteThemeMode;
  atmosphere?: string;
}) {
  const material = useMemo(() => {
    const variant = getVoxelBackdropVariant(themeMode, atmosphere);
    return new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new Color(variant.skyTop) },
        uBottom: { value: new Color(variant.skyBottom) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vPos;
        uniform vec3 uTop;
        uniform vec3 uBottom;
        void main() {
          float h = clamp(vPos.y / ${VR_SKY_RADIUS.toFixed(1)} * 0.5 + 0.5, 0.0, 1.0);
          gl_FragColor = vec4(mix(uBottom, uTop, h), 1.0);
        }
      `,
    });
  }, [themeMode, atmosphere]);

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh material={material} frustumCulled={false}>
      <sphereGeometry args={[VR_SKY_RADIUS, 32, 16]} />
    </mesh>
  );
}
