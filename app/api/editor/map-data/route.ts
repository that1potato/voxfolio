import { NextResponse } from "next/server";
import {
  MapFileError,
  saveMapDataFiles,
} from "@/lib/terrain-files";

function errorResponse(error: unknown) {
  if (error instanceof MapFileError) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: error.code, message: error.message },
      },
      { status: error.status },
    );
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "INVALID_JSON", message: error.message },
      },
      { status: 400 },
    );
  }
  const message = error instanceof Error ? error.message : "unknown map data file error";
  return NextResponse.json(
    {
      ok: false,
      error: { code: "FILE_OPERATION_FAILED", message },
    },
    { status: 500 },
  );
}

function developmentOnlyResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "DEVELOPMENT_ONLY",
        message: "map data files can only be changed while running npm run dev",
      },
    },
    { status: 403 },
  );
}

export async function PUT(request: Request) {
  if (process.env.NODE_ENV !== "development") return developmentOnlyResponse();

  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new MapFileError("INVALID_PAYLOAD", "request body must be an object", 400);
    }
    const payload = value as { blockTypes?: unknown; terrain?: unknown };
    const result = await saveMapDataFiles(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
