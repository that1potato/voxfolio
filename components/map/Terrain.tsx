"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import {
  getBlockType,
  getTerrainBlocks,
  type BlockTypesDoc,
  type SurfaceFace,
  type Terrain as TerrainData,
  type TerrainBlockPosition,
} from "@/lib/terrains";
import { resolveThemeColor } from "@/lib/theme-colors";
import type { SiteThemeMode } from "@/theme.config";
import { InstancedVoxels, type VoxelInstance } from "./InstancedVoxels";
import type { RadialRevealMask } from "@/lib/radial-reveal";

export type TerrainBuildMode = "add" | "delete";

export interface TerrainInteraction {
  enabled: boolean;
  mode: TerrainBuildMode;
  activeBlockTypeId: string;
  onSetBlock: (
    position: TerrainBlockPosition,
    blockTypeId: string | null,
  ) => void;
}

export interface TerrainSurfacePickInteraction {
  enabled: boolean;
  onPickSurface: (block: TerrainBlockPosition, face: SurfaceFace) => void;
}

interface Props {
  terrain: TerrainData;
  blockTypes: BlockTypesDoc;
  themeMode: SiteThemeMode;
  interaction?: TerrainInteraction;
  surfacePick?: TerrainSurfacePickInteraction;
  radialReveal?: RadialRevealMask;
}

interface HoverPreview {
  mode: TerrainBuildMode;
  position: TerrainBlockPosition;
}

type TerrainPointerIntersection = Pick<
  ThreeEvent<PointerEvent>,
  "face" | "object" | "point"
>;

const SOURCE_FACE_OFFSET = 0.001;

function blockPositionKey(position: TerrainBlockPosition): string {
  return position.join(",");
}

function samePreview(
  current: HoverPreview | null,
  next: HoverPreview | null,
): boolean {
  if (!current || !next) return current === next;
  return (
    current.mode === next.mode &&
    current.position[0] === next.position[0] &&
    current.position[1] === next.position[1] &&
    current.position[2] === next.position[2]
  );
}

function getFaceStep(event: TerrainPointerIntersection): TerrainBlockPosition | null {
  if (!event.face) return null;
  const normal = event.face.normal
    .clone()
    .transformDirection(event.object.matrixWorld);
  const absolute = [Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)];
  const largest = Math.max(...absolute);
  if (largest === 0) return null;
  if (absolute[0] === largest) return [Math.sign(normal.x), 0, 0];
  if (absolute[1] === largest) return [0, Math.sign(normal.y), 0];
  return [0, 0, Math.sign(normal.z)];
}

function faceStepToSurfaceFace(step: TerrainBlockPosition): SurfaceFace | null {
  if (step[1] > 0) return "top";
  if (step[1] < 0) return "bottom";
  if (step[0] > 0) return "east";
  if (step[0] < 0) return "west";
  if (step[2] > 0) return "south";
  if (step[2] < 0) return "north";
  return null;
}

export function Terrain({
  terrain,
  blockTypes,
  themeMode,
  interaction,
  surfacePick,
  radialReveal,
}: Props) {
  const [hoverPreview, setHoverPreview] = useState<HoverPreview | null>(null);
  const data = useMemo(() => {
    const definitions = new Map(
      blockTypes.blockTypes.map((blockType) => [blockType.id, blockType]),
    );
    const blocks = getTerrainBlocks(terrain);
    const instances: VoxelInstance[] = [];
    const occupied = new Set<string>();

    // Per-XZ-column max height — the whole column shares it so the radial-reveal
    // wavefront lags by location (the ring bulges over tall terrain).
    const columnMaxY = new Map<string, number>();
    blocks.forEach((block) => {
      const key = `${block.position[0]},${block.position[2]}`;
      const current = columnMaxY.get(key);
      if (current === undefined || block.position[1] > current) {
        columnMaxY.set(key, block.position[1]);
      }
    });

    blocks.forEach((block) => {
      const blockType = definitions.get(block.blockTypeId);
      if (!blockType) return;
      occupied.add(blockPositionKey(block.position));
      instances.push({
        position: block.position,
        color: resolveThemeColor(blockType.appearance, themeMode),
        revealHeight:
          columnMaxY.get(`${block.position[0]},${block.position[2]}`) ?? 0,
      });
    });

    return { instances, occupied };
  }, [terrain, blockTypes, themeMode]);

  const resolvePreview = useCallback(
    (event: TerrainPointerIntersection): HoverPreview | null => {
      if (!interaction?.enabled) return null;
      const step = getFaceStep(event);
      if (!step) return null;
      const source: TerrainBlockPosition = [
        Math.round(event.point.x - step[0] * SOURCE_FACE_OFFSET),
        Math.round(event.point.y - step[1] * SOURCE_FACE_OFFSET),
        Math.round(event.point.z - step[2] * SOURCE_FACE_OFFSET),
      ];
      if (!data.occupied.has(blockPositionKey(source))) return null;

      if (interaction.mode === "delete") {
        return source[1] >= 0
          ? { mode: "delete", position: source }
          : null;
      }

      const target: TerrainBlockPosition = [
        source[0] + step[0],
        source[1] + step[1],
        source[2] + step[2],
      ];
      if (target[1] < 0 || data.occupied.has(blockPositionKey(target))) {
        return null;
      }
      return { mode: "add", position: target };
    },
    [data.occupied, interaction?.enabled, interaction?.mode],
  );

  const resolveSurfaceHit = useCallback(
    (
      event: TerrainPointerIntersection,
    ): { block: TerrainBlockPosition; face: SurfaceFace } | null => {
      if (!surfacePick?.enabled) return null;
      const step = getFaceStep(event);
      if (!step) return null;
      const face = faceStepToSurfaceFace(step);
      if (!face) return null;
      const source: TerrainBlockPosition = [
        Math.round(event.point.x - step[0] * SOURCE_FACE_OFFSET),
        Math.round(event.point.y - step[1] * SOURCE_FACE_OFFSET),
        Math.round(event.point.z - step[2] * SOURCE_FACE_OFFSET),
      ];
      if (!data.occupied.has(blockPositionKey(source))) return null;
      const neighbor: TerrainBlockPosition = [
        source[0] + step[0],
        source[1] + step[1],
        source[2] + step[2],
      ];
      if (data.occupied.has(blockPositionKey(neighbor))) return null;
      return { block: source, face };
    },
    [data.occupied, surfacePick?.enabled],
  );

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const preview = resolvePreview(event);
      setHoverPreview((current) =>
        samePreview(current, preview) ? current : preview,
      );
    },
    [resolvePreview],
  );

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (event.nativeEvent.button !== 0) return;
      if (surfacePick?.enabled) {
        const hit = resolveSurfaceHit(event);
        if (!hit) return;
        event.stopPropagation();
        surfacePick.onPickSurface(hit.block, hit.face);
        return;
      }
      if (!interaction?.enabled) return;
      const preview = resolvePreview(event);
      if (!preview) return;
      event.stopPropagation();
      interaction.onSetBlock(
        preview.position,
        preview.mode === "add" ? interaction.activeBlockTypeId : null,
      );
      setHoverPreview(null);
    },
    [interaction, resolvePreview, resolveSurfaceHit, surfacePick],
  );

  const handlePointerOut = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const currentTerrainHit = event.intersections.find(
        (intersection) => intersection.object === event.object,
      );
      const preview = currentTerrainHit
        ? resolvePreview(currentTerrainHit)
        : null;
      setHoverPreview((current) =>
        samePreview(current, preview) ? current : preview,
      );
    },
    [resolvePreview],
  );

  useEffect(() => {
    setHoverPreview(null);
  }, [
    terrain,
    interaction?.activeBlockTypeId,
    interaction?.enabled,
    interaction?.mode,
  ]);

  const previewBlockType = interaction
    ? getBlockType(blockTypes, interaction.activeBlockTypeId)
    : undefined;

  const isInteractive = interaction?.enabled || surfacePick?.enabled;

  return (
    <group>
      <InstancedVoxels
        instances={data.instances}
        onPointerMove={interaction?.enabled ? handlePointerMove : undefined}
        onPointerOut={interaction?.enabled ? handlePointerOut : undefined}
        onClick={isInteractive ? handleClick : undefined}
        radialReveal={radialReveal}
      />
      {hoverPreview && (
        <mesh
          position={hoverPreview.position}
          scale={1.035}
          raycast={() => undefined}
        >
          <boxGeometry args={[1, 1, 1]} />
          {hoverPreview.mode === "add" ? (
            <meshStandardMaterial
              color={
                previewBlockType
                  ? resolveThemeColor(previewBlockType.appearance, themeMode)
                  : "#f5f1e6"
              }
              transparent
              opacity={0.5}
              depthWrite={false}
              roughness={0.85}
            />
          ) : (
            <meshBasicMaterial
              color="#ef4444"
              transparent
              opacity={0.65}
              depthWrite={false}
            />
          )}
        </mesh>
      )}
    </group>
  );
}
