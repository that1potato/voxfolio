"use client";

import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
  RGBADepthPacking,
  Vector2,
} from "three";
import { palette } from "@/site.config";
import { advanceBlend } from "@/lib/theme-transition";
import {
  TERRAIN_REVEAL_BAND,
  TERRAIN_REVEAL_HEIGHT_DELAY,
  TERRAIN_REVEAL_RISE,
  type RadialRevealMask,
} from "@/lib/radial-reveal";

export interface VoxelInstance {
  position: [number, number, number];
  /** Palette token (e.g. "brown") or a raw color string — same contract as Voxel. */
  color: string;
  scale?: number | [number, number, number];
  /**
   * Column height at this voxel's XZ cell (max Y of the stack). Used to delay the
   * radial-reveal wavefront over tall terrain. Defaults to 0 (no delay).
   */
  revealHeight?: number;
}

interface Props {
  instances: VoxelInstance[];
  castShadow?: boolean;
  receiveShadow?: boolean;
  roughness?: number;
  /** Emissive color for a glowing batch (e.g. Nixie digits). Default off. */
  emissive?: string;
  /** Emissive intensity; only meaningful when `emissive` is set. Default 0. */
  emissiveIntensity?: number;
  onPointerMove?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (event: ThreeEvent<PointerEvent>) => void;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
  radialReveal?: RadialRevealMask;
}

const resolve = (c: string) => (palette as Record<string, string>)[c] ?? c;

/** Cheap position signature: concat all rounded positions as a string. */
function positionSig(instances: VoxelInstance[]): string {
  // We can't include color in the sig — a pure recolor is detected by color
  // changing while the sig stays the same.
  let s = "";
  for (let i = 0; i < instances.length; i++) {
    const p = instances[i].position;
    s += `${p[0]},${p[1]},${p[2]};`;
  }
  return s;
}

// GLSL float literals for the reveal tunables (single source of truth in lib).
const GLSL_REVEAL_BAND = TERRAIN_REVEAL_BAND.toFixed(4);
const GLSL_REVEAL_RISE = TERRAIN_REVEAL_RISE.toFixed(4);
const GLSL_REVEAL_HEIGHT_DELAY = TERRAIN_REVEAL_HEIGHT_DELAY.toFixed(4);

const RADIAL_REVEAL_VERTEX_VARYING = `
varying float vRevealDistance;
uniform vec2 uRevealOrigin;
uniform float uRevealEnabled;
uniform float uRevealMode;
uniform float uRevealRadius;
#ifdef USE_INSTANCING
attribute float aRevealHeight;
#endif
`;
// Bakes a per-column height delay into vRevealDistance (the wavefront lags over
// tall terrain), then — while a reveal is active — sprouts each voxel up from its
// base across a soft band riding the wavefront instead of popping it on/off.
const RADIAL_REVEAL_VERTEX_INJECT = `
#ifdef USE_INSTANCING
  vec3 revealCenter = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#else
  vec3 revealCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#endif
vec2 revealCell = floor(revealCenter.xz) + vec2(0.5);
vRevealDistance = length(revealCell - uRevealOrigin);
#ifdef USE_INSTANCING
  vRevealDistance += aRevealHeight * ${GLSL_REVEAL_HEIGHT_DELAY};
#endif
if (uRevealEnabled > 0.5) {
  float revealSigned = (uRevealMode < 0.5)
    ? (uRevealRadius - vRevealDistance)
    : (vRevealDistance - uRevealRadius);
  float revealLocal = clamp(revealSigned / ${GLSL_REVEAL_BAND}, 0.0, 1.0);
  float revealEased = revealLocal * revealLocal * (3.0 - 2.0 * revealLocal);
  transformed.xz *= revealEased;
  transformed.y = (transformed.y + 0.5) * revealEased - 0.5;
  transformed.y -= (1.0 - revealEased) * ${GLSL_REVEAL_RISE};
}
`;
const RADIAL_REVEAL_FRAGMENT_PREAMBLE = `
varying float vRevealDistance;
uniform float uRevealEnabled;
uniform float uRevealMode;
uniform float uRevealRadius;
uniform vec2 uRevealOrigin;
`;
const RADIAL_REVEAL_FRAGMENT_INJECT = `
if (uRevealEnabled > 0.5) {
  bool revealInside = vRevealDistance <= uRevealRadius;
  if ((uRevealMode < 0.5 && !revealInside) || (uRevealMode > 0.5 && revealInside)) {
    discard;
  }
}
`;

/**
 * Renders an arbitrary set of unit cubes as a SINGLE THREE.InstancedMesh —
 * one draw call for the whole batch — sharing one BoxGeometry and one
 * MeshStandardMaterial, with per-cube color via the instanceColor attribute.
 *
 * This is the performance-critical replacement for mapping hundreds/thousands
 * of <Voxel/> meshes (terrain footprint, voxel text). Voxel.tsx is kept for
 * genuine one-off cubes.
 *
 * NOTE: an InstancedMesh's instance count is fixed at construction, so the
 * element is keyed by count upstream/here — changing the number of cubes
 * rebuilds the mesh; changing only positions/colors re-fills it in place.
 *
 * Color transitions: when the same positions receive new colors (i.e. a theme
 * mode change), the component lerps each instance's displayed color toward the
 * target over ~800 ms using the shared THEME_DAMPING constant, matching the
 * CSS backdrop cross-fade timing. Structural changes (count or position
 * differences) always snap immediately.
 */
export function InstancedVoxels({
  instances,
  castShadow = true,
  receiveShadow = true,
  roughness = 0.85,
  emissive,
  emissiveIntensity = 0,
  onPointerMove,
  onPointerOut,
  onClick,
  radialReveal,
}: Props) {
  const meshRef   = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const count = instances.length;
  const revealUniforms = useMemo(
    () => ({
      uRevealEnabled: { value: 0 },
      uRevealMode: { value: 0 },
      uRevealOrigin: { value: new Vector2() },
      uRevealRadius: { value: 0 },
    }),
    [],
  );

  const handleBeforeCompile = useCallback(
    (shader: {
      uniforms: Record<string, { value: unknown }>;
      vertexShader: string;
      fragmentShader: string;
    }) => {
      Object.assign(shader.uniforms, revealUniforms);
      shader.vertexShader =
        RADIAL_REVEAL_VERTEX_VARYING +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>\n${RADIAL_REVEAL_VERTEX_INJECT}`,
        );
      shader.fragmentShader =
        RADIAL_REVEAL_FRAGMENT_PREAMBLE +
        shader.fragmentShader.replace(
          "void main() {",
          `void main() {\n${RADIAL_REVEAL_FRAGMENT_INJECT}`,
        );
    },
    [revealUniforms],
  );
  const handleDepthBeforeCompile = useCallback(
    (shader: {
      uniforms: Record<string, { value: unknown }>;
      vertexShader: string;
      fragmentShader: string;
    }) => {
      Object.assign(shader.uniforms, revealUniforms);
      shader.vertexShader =
        RADIAL_REVEAL_VERTEX_VARYING +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>\n${RADIAL_REVEAL_VERTEX_INJECT}`,
        );
      shader.fragmentShader =
        RADIAL_REVEAL_FRAGMENT_PREAMBLE +
        shader.fragmentShader.replace(
          "void main() {",
          `void main() {\n${RADIAL_REVEAL_FRAGMENT_INJECT}`,
        );
    },
    [revealUniforms],
  );

  // --- Transition state ----------------------------------------------------
  // `from`: the colors currently rendered for each instance (displayed on screen).
  // `to`:   the colors we want to reach.
  // `blend`: the 0→1 progress of the ongoing cross-fade.
  // `transitioning`: true while a fade is in progress.
  const fromColors    = useRef<Color[]>([]);
  const toColors      = useRef<Color[]>([]);
  const blend         = useRef({ value: 1 }); // 1 = fully at "to"
  const transitioning = useRef(false);
  const prevSig       = useRef<string>("");

  // Scratch Color reused across writes.
  const _c = useRef(new Color());

  // Helper: write all displayed colors (lerped between from/to by t) into the mesh.
  function applyColors(mesh: InstancedMesh, t: number) {
    const from = fromColors.current;
    const to   = toColors.current;
    const col  = _c.current;
    for (let i = 0; i < from.length; i++) {
      col.lerpColors(from[i], to[i], t);
      mesh.setColorAt(i, col);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  // --- Main layout effect: apply instances (positions + colors) ----------
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dummy  = new Object3D();
    const sig    = positionSig(instances);
    const isPureRecolor =
      sig === prevSig.current &&
      prevSig.current !== "" &&
      instances.length === fromColors.current.length;

    // Always update matrices and bounding sphere.
    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      dummy.position.set(inst.position[0], inst.position[1], inst.position[2]);
      const s = inst.scale ?? 1;
      if (typeof s === "number") dummy.scale.set(s, s, s);
      else dummy.scale.set(s[0], s[1], s[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();

    // Per-instance reveal height (column max-Y) — static per terrain; lets the
    // radial-reveal wavefront lag over tall stacks. Defaults to 0 (no delay) for
    // text/surroundings that don't supply it.
    let heightAttr = mesh.geometry.getAttribute("aRevealHeight") as unknown as
      | InstancedBufferAttribute
      | undefined;
    if (!heightAttr || heightAttr.count !== instances.length) {
      heightAttr = new InstancedBufferAttribute(
        new Float32Array(instances.length),
        1,
      );
      mesh.geometry.setAttribute("aRevealHeight", heightAttr);
    }
    for (let i = 0; i < instances.length; i++) {
      heightAttr.setX(i, instances[i].revealHeight ?? 0);
    }
    heightAttr.needsUpdate = true;

    // Resolve target colors.
    const newTargets = instances.map((inst) => new Color(resolve(inst.color)));

    if (isPureRecolor) {
      // Snapshot the currently displayed colors as the "from" side.
      // If a prior transition was in progress, interpolate from its current
      // mid-point so the new transition starts from the right place.
      const currentT = blend.current.value;
      fromColors.current = fromColors.current.map((fc, i) =>
        new Color().lerpColors(fc, toColors.current[i], currentT),
      );
      toColors.current   = newTargets;
      blend.current.value = 0;
      transitioning.current = true;
      // Apply the "from" snapshot immediately (t=0 → display the old colors).
      applyColors(mesh, 0);
    } else {
      // Structural change or first mount — snap to target immediately.
      fromColors.current    = newTargets.map((c) => c.clone());
      toColors.current      = newTargets;
      blend.current.value   = 1;
      transitioning.current = false;
      applyColors(mesh, 1);
    }

    prevSig.current = sig;
    invalidate();
  }, [instances, invalidate]);

  // --- useFrame: advance the blend each tick while transitioning ----------
  useFrame((_, delta) => {
    if (radialReveal) {
      const reveal = radialReveal.state.current;
      revealUniforms.uRevealEnabled.value = reveal.active ? 1 : 0;
      revealUniforms.uRevealMode.value = radialReveal.mode === "inside" ? 0 : 1;
      revealUniforms.uRevealOrigin.value.set(reveal.origin[0], reveal.origin[2]);
      revealUniforms.uRevealRadius.value = reveal.radius;
    } else {
      revealUniforms.uRevealEnabled.value = 0;
    }

    if (!transitioning.current) return;
    const mesh = meshRef.current;
    if (!mesh) return;

    const settled = advanceBlend(blend.current, 1, delta);
    applyColors(mesh, blend.current.value);

    if (settled) {
      transitioning.current = false;
      // Snap from === to so the next transition starts cleanly.
      fromColors.current = toColors.current.map((c) => c.clone());
    } else {
      invalidate();
    }
  });

  return (
    <instancedMesh
      // Rebuild the buffer when the instance count changes.
      key={count}
      ref={meshRef}
      args={[undefined, undefined, count]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      onPointerMove={onPointerMove}
      onPointerOut={onPointerOut}
      onClick={onClick}
      // Single bounding sphere for the whole batch — keep it always drawn so
      // an edge-clipping sphere never makes the island/text vanish.
      frustumCulled={false}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        roughness={roughness}
        emissive={emissive ?? "#000000"}
        emissiveIntensity={emissive ? emissiveIntensity : 0}
        onBeforeCompile={handleBeforeCompile}
        customProgramCacheKey={() => "instanced-voxels-radial-reveal-v3"}
      />
      <meshDepthMaterial
        attach="customDepthMaterial"
        depthPacking={RGBADepthPacking}
        onBeforeCompile={handleDepthBeforeCompile}
        customProgramCacheKey={() => "instanced-voxels-radial-depth-v2"}
      />
    </instancedMesh>
  );
}
