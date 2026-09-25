import type { BlockTypesDoc, Terrain } from "../terrains";
import type { GeneratedSurroundings } from "../surroundings/types";

/**
 * Network calls to the dev-only `/api/editor/*` routes. Plain async functions
 * that throw on failure — the store owns all state transitions and error
 * capture, so this layer stays free of store concerns.
 */

interface ApiErrorBody {
  error?: {
    message?: string;
  };
}

async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body.error?.message ?? `request failed with status ${response.status}`;
  } catch {
    return `request failed with status ${response.status}`;
  }
}

/** PUT dirty block types and/or a single terrain. Throws on failure. */
export async function saveMapData(body: {
  blockTypes?: BlockTypesDoc;
  terrain?: Terrain;
}): Promise<void> {
  const response = await fetch("/api/editor/map-data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await readApiError(response));
}

/** POST a terrain for procedural surroundings generation. Returns the result, if any. */
export async function requestGeneratedSurroundings(
  terrainId: string,
  body: { terrain: Terrain; blockTypes: BlockTypesDoc; seed: number },
): Promise<GeneratedSurroundings | undefined> {
  const response = await fetch(
    `/api/editor/generated-surroundings/${encodeURIComponent(terrainId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) throw new Error(await readApiError(response));
  const result = (await response.json()) as {
    ok: boolean;
    surroundings?: GeneratedSurroundings;
  };
  return result.surroundings;
}

/** DELETE a persisted terrain. Throws on failure. */
export async function deleteTerrainRequest(id: string): Promise<void> {
  const response = await fetch(`/api/editor/terrains/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(await readApiError(response));
}
