import { NextResponse } from "next/server";
import { getAtmosphere } from "@/atmosphere.config";
import { MapFileError, saveGeneratedSurroundingsFile } from "@/lib/terrain-files";
import { generateSurroundings } from "@/lib/surroundings/generate";
import { validateTerrain, validateBlockTypes, type Terrain, type BlockTypesDoc } from "@/lib/terrains";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function errorResponse(error: unknown) {
  if (error instanceof MapFileError) {
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  const message = error instanceof Error ? error.message : "unknown error";
  return NextResponse.json(
    { ok: false, error: { code: "GENERATION_FAILED", message } },
    { status: 500 },
  );
}

function developmentOnlyResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "DEVELOPMENT_ONLY",
        message: "surroundings can only be generated while running npm run dev",
      },
    },
    { status: 403 },
  );
}

export async function POST(request: Request, { params }: RouteContext) {
  if (process.env.NODE_ENV !== "development") return developmentOnlyResponse();

  try {
    const { id } = await params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new MapFileError("INVALID_PAYLOAD", "request body must be an object", 400);
    }
    const { terrain: rawTerrain, blockTypes: rawBlockTypes, seed } = body as {
      terrain?: unknown;
      blockTypes?: unknown;
      seed?: unknown;
    };

    if (!rawTerrain || !rawBlockTypes) {
      throw new MapFileError("INVALID_PAYLOAD", "terrain and blockTypes are required", 400);
    }

    // Re-use existing validators for safety
    validateBlockTypes(rawBlockTypes);
    const blockTypes = rawBlockTypes as BlockTypesDoc;
    const blockTypeIds = new Set(blockTypes.blockTypes.map((bt) => bt.id));
    validateTerrain(rawTerrain, blockTypeIds);
    const terrain = rawTerrain as Terrain;

    if (terrain.id !== id) {
      throw new MapFileError(
        "ID_MISMATCH",
        `terrain id "${terrain.id}" does not match route id "${id}"`,
        400,
      );
    }

    const result = generateSurroundings(terrain, {
      seed: typeof seed === "number" ? seed : undefined,
      // The terrain's atmosphere preset (if any) tints the generated ring.
      palette: getAtmosphere(terrain.atmosphere)?.surroundings,
    });
    await saveGeneratedSurroundingsFile(id, result);
    return NextResponse.json({ ok: true, surroundings: result });
  } catch (error) {
    return errorResponse(error);
  }
}
