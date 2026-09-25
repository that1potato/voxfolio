"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Vector3, type Object3D } from "three";
import { Handle, type HandleState } from "@react-three/handle";

/**
 * visionOS-style window chrome for the immersive "package" (the tabletop island
 * + the floating reading panel): a slim translucent bar floating below the
 * package's front edge, plus a small resize knob beside it.
 *
 * - Grabbing the bar carries the package, and while it moves it yaws to keep
 *   facing the viewer (like dragging a visionOS window around you).
 * - Grabbing the knob and dragging away from the package grows it; dragging
 *   toward it shrinks it (`translate: "as-scale"` maps one-hand translation
 *   onto uniform scale).
 *
 * The chrome lives *next to* the rig (not inside it): a per-frame follower
 * parks it under the rig's current footprint so it tracks every move/resize but
 * keeps a constant physical size and the package's own orientation. It is
 * mounted for the whole session (reading mode included). Dynamically imported
 * by VoxelMap and mounted only in a session, so `@react-three/handle` stays in
 * the XR chunk.
 */

// Bar/knob dimensions (metres — constant physical size, visionOS-like).
const BAR_LENGTH = 0.11;
const BAR_RADIUS = 0.006;
const KNOB_RADIUS = 0.009;
const KNOB_GAP = 0.028; // between the bar's right end and the knob centre
// Invisible hit volumes around the (thin) visuals, so the ray grabs them from
// any angle without precise aim.
const BAR_HIT_SIZE: [number, number, number] = [BAR_LENGTH + 0.06, 0.055, 0.055];
const KNOB_HIT_RADIUS = 0.032;
// Chrome placement relative to the package's front-bottom edge.
const DROP_BELOW = 0.055;
const GAP_FRONT = 0.04;
// Idle vs ray-hovered look. The pill stays near-solid with a soft dark halo so
// it never washes out against the bright reading panel or an AR room.
const IDLE_OPACITY = 0.85;
const HOVER_OPACITY = 1;
const HALO_SCALE = 1.9;
const HALO_OPACITY = 0.22;
const SCALE_MIN = 0.3;
// The base footprint is 1.2m, so 2.5× already reaches room-filling 3m.
const SCALE_MAX = 2.5;

const _offset = new Vector3();
const _cam = new Vector3();

interface Props {
  /** The package rig this chrome moves/resizes. */
  targetRef: RefObject<Group | null>;
  /** Half-depth of the package footprint at rig scale 1 (metres). */
  halfDepth: number;
  /** Lowest allowed rig-local Y, so the island can't sink under the floor. */
  minY: number;
}

export function XRPackageHandles({ targetRef, halfDepth, minY }: Props) {
  const groupRef = useRef<Group>(null);
  const camera = useThree((state) => state.camera);
  const [barHover, setBarHover] = useState(false);
  const [knobHover, setKnobHover] = useState(false);

  // Follower: park the chrome just below the package's front edge, tracking the
  // rig's live position/rotation/scale but staying at constant physical size.
  // The chrome keeps the package's own orientation (no camera billboarding) so
  // it reads as fixed window furniture. Runs every frame — sessions render with
  // frameloop="always", so this always ticks.
  useFrame(() => {
    const rig = targetRef.current;
    const group = groupRef.current;
    if (!rig || !group) return;
    _offset
      .set(0, -DROP_BELOW, halfDepth * rig.scale.x + GAP_FRONT)
      .applyQuaternion(rig.quaternion);
    group.position.copy(rig.position).add(_offset);
    group.quaternion.copy(rig.quaternion);
  });

  // Carry the package: take the dragged position (floor-clamped) and yaw the
  // package to face the viewer as it moves, visionOS-window style.
  const applyMove = useCallback(
    (state: HandleState<unknown>, target: Object3D) => {
      target.position.copy(state.current.position);
      if (target.position.y < minY) target.position.y = minY;
      camera.getWorldPosition(_cam);
      target.parent?.worldToLocal(_cam);
      target.rotation.set(
        0,
        Math.atan2(_cam.x - target.position.x, _cam.z - target.position.z),
        0,
      );
    },
    [camera, minY],
  );

  // Resize: uniform scale only (position/rotation stay), clamped so the package
  // can't collapse or explode.
  const applyResize = useCallback(
    (state: HandleState<unknown>, target: Object3D) => {
      const s = Math.min(
        SCALE_MAX,
        Math.max(SCALE_MIN, state.current.scale.x),
      );
      target.scale.setScalar(s);
    },
    [],
  );

  return (
    <group ref={groupRef}>
      {/* Move bar. */}
      <Handle
        targetRef={targetRef}
        translate
        rotate={false}
        scale={false}
        multitouch={false}
        apply={applyMove}
      >
        <group
          scale={barHover ? 1.15 : 1}
          onPointerOver={() => setBarHover(true)}
          onPointerOut={() => setBarHover(false)}
        >
          {/* Generous invisible hit volume — the pill itself is too thin to
              ray-hit reliably. colorWrite/depthWrite off: raycastable, unseen. */}
          <mesh>
            <boxGeometry args={BAR_HIT_SIZE} />
            <meshBasicMaterial colorWrite={false} depthWrite={false} />
          </mesh>
          {/* Soft dark halo so the pill reads on bright backgrounds too. */}
          <mesh rotation={[0, 0, Math.PI / 2]} scale={HALO_SCALE}>
            <capsuleGeometry args={[BAR_RADIUS, BAR_LENGTH / HALO_SCALE, 6, 16]} />
            <meshBasicMaterial
              color="#1a1a1a"
              transparent
              opacity={HALO_OPACITY}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[BAR_RADIUS, BAR_LENGTH, 6, 16]} />
            <meshBasicMaterial
              color={barHover ? "#ffffff" : "#f2f2f2"}
              transparent
              opacity={barHover ? HOVER_OPACITY : IDLE_OPACITY}
              toneMapped={false}
            />
          </mesh>
        </group>
      </Handle>

      {/* Resize knob, beside the bar. */}
      <Handle
        targetRef={targetRef}
        translate="as-scale"
        rotate={false}
        scale={{ uniform: true }}
        apply={applyResize}
      >
        <group
          position={[BAR_LENGTH / 2 + KNOB_GAP, 0, 0]}
          scale={knobHover ? 1.25 : 1}
          onPointerOver={() => setKnobHover(true)}
          onPointerOut={() => setKnobHover(false)}
        >
          {/* Invisible hit volume (see bar). */}
          <mesh>
            <sphereGeometry args={[KNOB_HIT_RADIUS, 12, 12]} />
            <meshBasicMaterial colorWrite={false} depthWrite={false} />
          </mesh>
          <mesh scale={HALO_SCALE}>
            <sphereGeometry args={[KNOB_RADIUS, 20, 20]} />
            <meshBasicMaterial
              color="#1a1a1a"
              transparent
              opacity={HALO_OPACITY}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[KNOB_RADIUS, 20, 20]} />
            <meshBasicMaterial
              color={knobHover ? "#ffffff" : "#f2f2f2"}
              transparent
              opacity={knobHover ? HOVER_OPACITY : IDLE_OPACITY}
              toneMapped={false}
            />
          </mesh>
        </group>
      </Handle>
    </group>
  );
}
