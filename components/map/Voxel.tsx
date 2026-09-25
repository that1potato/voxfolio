"use client";

import { palette } from "@/site.config";

interface Props {
  position: [number, number, number];
  color?: string;
  scale?: [number, number, number] | number;
}

/**
 * A single voxel cube. The building block for terrain, location markers,
 * and the character. Keep meshes simple — every cube adds geometry.
 */
export function Voxel({ position, color = "brown", scale = 1 }: Props) {
  const resolved = (palette as Record<string, string>)[color] ?? color;
  const s = typeof scale === "number" ? [scale, scale, scale] : scale;
  return (
    <mesh position={position} scale={s as [number, number, number]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={resolved} roughness={0.85} />
    </mesh>
  );
}
