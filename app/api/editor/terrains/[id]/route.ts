import { NextResponse } from "next/server";
import {
  deleteTerrainFile,
  MapFileError,
} from "@/lib/terrain-files";

interface RouteContext {
  params: Promise<{ id: string }>;
}

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
  const message = error instanceof Error ? error.message : "unknown terrain file error";
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
        message: "terrain files can only be changed while running npm run dev",
      },
    },
    { status: 403 },
  );
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  if (process.env.NODE_ENV !== "development") return developmentOnlyResponse();

  try {
    const { id } = await params;
    await deleteTerrainFile(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
