import "server-only";

import fs from "node:fs";
import path from "node:path";
import type { GeneratedSurroundings } from "./surroundings/types";
import {
  validateBlockTypes,
  validateMapData,
  validateTerrain,
  validateTerrainId,
  validateTerrainsManifest,
  type BlockTypesDoc,
  type MapData,
  type Terrain,
  type TerrainsDoc,
  type TerrainsManifest,
} from "./terrains";

export const BLOCK_TYPES_PATH = path.join(process.cwd(), "data", "block-types.json");
export const TERRAIN_DATA_DIR = path.join(process.cwd(), "data", "terrains");
export const TERRAIN_MANIFEST_PATH = path.join(TERRAIN_DATA_DIR, "index.json");
export const GENERATED_SURROUNDINGS_DIR = path.join(process.cwd(), "data", "generated-surroundings");

export class MapFileError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export function terrainFilePath(id: string): string {
  return path.join(TERRAIN_DATA_DIR, `${id}.json`);
}

export function loadBlockTypes(): BlockTypesDoc {
  const blockTypes = JSON.parse(fs.readFileSync(BLOCK_TYPES_PATH, "utf8"));
  validateBlockTypes(blockTypes);
  return blockTypes;
}

export function loadTerrainManifest(): TerrainsManifest {
  const manifest = JSON.parse(fs.readFileSync(TERRAIN_MANIFEST_PATH, "utf8"));
  validateTerrainsManifest(manifest);
  return manifest;
}

export function loadTerrain(
  id: string,
  blockTypeIds = new Set(loadBlockTypes().blockTypes.map((blockType) => blockType.id)),
): Terrain {
  const terrain = JSON.parse(fs.readFileSync(terrainFilePath(id), "utf8"));
  validateTerrain(terrain, blockTypeIds);
  if (terrain.id !== id) {
    throw new Error(`terrain file "${id}.json" contains id "${terrain.id}"`);
  }
  return terrain;
}

export function loadTerrains(blockTypes = loadBlockTypes()): TerrainsDoc {
  const manifest = loadTerrainManifest();
  const blockTypeIds = new Set(blockTypes.blockTypes.map((blockType) => blockType.id));
  return {
    version: manifest.version,
    rootTerrainId: manifest.rootTerrainId,
    terrains: manifest.terrainIds.map((id) => loadTerrain(id, blockTypeIds)),
  };
}

export function generatedSurroundingsPath(id: string): string {
  return path.join(GENERATED_SURROUNDINGS_DIR, `${id}.json`);
}

export function loadGeneratedSurroundings(id: string): GeneratedSurroundings | null {
  try {
    const data: unknown = JSON.parse(fs.readFileSync(generatedSurroundingsPath(id), "utf8"));
    // Discard old v1 files silently — regeneration required.
    if (typeof data !== "object" || data === null || (data as { version?: number }).version !== 2)
      return null;
    return data as GeneratedSurroundings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function saveGeneratedSurroundingsFile(
  id: string,
  data: GeneratedSurroundings,
): Promise<void> {
  await fs.promises.mkdir(GENERATED_SURROUNDINGS_DIR, { recursive: true });
  await fs.promises.writeFile(generatedSurroundingsPath(id), formatJson(data), "utf8");
}

export function loadMapData(): MapData {
  const blockTypes = loadBlockTypes();
  const mapData = { blockTypes, terrains: loadTerrains(blockTypes) };
  validateMapData(mapData);
  const surroundings: Record<string, GeneratedSurroundings> = {};
  for (const terrain of mapData.terrains.terrains) {
    const s = loadGeneratedSurroundings(terrain.id);
    if (s) surroundings[terrain.id] = s;
  }
  return { ...mapData, surroundings };
}

function formatJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

interface FileUpdate {
  file: string;
  value: unknown;
}

async function writeJsonTransaction(updates: FileUpdate[]): Promise<void> {
  const snapshots = await Promise.all(
    updates.map(async ({ file }) => {
      try {
        return await fs.promises.readFile(file, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    }),
  );
  const written: number[] = [];

  try {
    for (let index = 0; index < updates.length; index++) {
      await fs.promises.writeFile(
        updates[index].file,
        formatJson(updates[index].value),
        "utf8",
      );
      written.push(index);
    }
  } catch (error) {
    for (const index of written.reverse()) {
      const snapshot = snapshots[index];
      if (snapshot === null) {
        await fs.promises.rm(updates[index].file, { force: true });
      } else {
        await fs.promises.writeFile(updates[index].file, snapshot, "utf8");
      }
    }
    throw error;
  }
}

interface MapDataSavePayload {
  blockTypes?: unknown;
  terrain?: unknown;
}

export async function saveMapDataFiles(
  payload: MapDataSavePayload,
): Promise<{ blockTypes: BlockTypesDoc; terrain?: Terrain; created: boolean }> {
  if (payload.blockTypes === undefined && payload.terrain === undefined) {
    throw new MapFileError("EMPTY_UPDATE", "no map data changes were provided", 400);
  }

  const current = loadMapData();
  const manifest = loadTerrainManifest();
  let blockTypes = current.blockTypes;
  let terrain: Terrain | undefined;

  try {
    if (payload.blockTypes !== undefined) {
      validateBlockTypes(payload.blockTypes);
      blockTypes = payload.blockTypes;
    }
    const blockTypeIds = new Set(blockTypes.blockTypes.map((blockType) => blockType.id));
    if (payload.terrain !== undefined) {
      validateTerrain(payload.terrain, blockTypeIds);
      terrain = payload.terrain;
    }

    const terrains = terrain
      ? current.terrains.terrains.some((item) => item.id === terrain?.id)
        ? current.terrains.terrains.map((item) => (item.id === terrain?.id ? terrain : item))
        : [...current.terrains.terrains, terrain]
      : current.terrains.terrains;
    validateMapData({
      blockTypes,
      terrains: {
        ...current.terrains,
        terrains,
      },
    });
  } catch (error) {
    throw new MapFileError(
      "INVALID_MAP_DATA",
      error instanceof Error ? error.message : "map data validation failed",
      400,
    );
  }

  const created = !!terrain && !manifest.terrainIds.includes(terrain.id);
  const updates: FileUpdate[] = [];
  if (payload.blockTypes !== undefined) {
    updates.push({ file: BLOCK_TYPES_PATH, value: blockTypes });
  }
  if (terrain) {
    updates.push({ file: terrainFilePath(terrain.id), value: terrain });
  }
  if (created && terrain) {
    updates.push({
      file: TERRAIN_MANIFEST_PATH,
      value: {
        ...manifest,
        terrainIds: [...manifest.terrainIds, terrain.id],
      } satisfies TerrainsManifest,
    });
  }

  await writeJsonTransaction(updates);
  return { blockTypes, terrain, created };
}

export async function deleteTerrainFile(routeId: string): Promise<void> {
  try {
    validateTerrainId(routeId, "route terrain id");
  } catch (error) {
    throw new MapFileError(
      "INVALID_TERRAIN_ID",
      error instanceof Error ? error.message : "terrain id validation failed",
      400,
    );
  }
  const manifest = loadTerrainManifest();
  if (routeId === manifest.rootTerrainId) {
    throw new MapFileError(
      "ROOT_TERRAIN",
      "the root terrain cannot be deleted",
      409,
    );
  }
  if (!manifest.terrainIds.includes(routeId)) {
    throw new MapFileError(
      "NOT_FOUND",
      `terrain "${routeId}" does not exist`,
      404,
    );
  }

  const file = terrainFilePath(routeId);
  const terrainJson = await fs.promises.readFile(file, "utf8");
  await fs.promises.rm(file);
  try {
    await fs.promises.writeFile(
      TERRAIN_MANIFEST_PATH,
      formatJson({
        ...manifest,
        terrainIds: manifest.terrainIds.filter((id) => id !== routeId),
      }),
      "utf8",
    );
  } catch (error) {
    await fs.promises.writeFile(file, terrainJson, "utf8");
    throw error;
  }
  // Generated surroundings are keyed by terrain id; remove them so a later
  // terrain reusing this id can't resurrect a stale ring.
  await fs.promises.rm(generatedSurroundingsPath(routeId), { force: true });
}
