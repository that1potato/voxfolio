import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ASSET_DIR = path.join(process.cwd(), "public", "map-assets");

interface DetectedImage {
  extension: "png" | "jpg" | "webp" | "avif" | "svg" | "gif";
  mimeType: string;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return Buffer.from(bytes.subarray(start, end)).toString("ascii");
}

function assertSafeSvg(bytes: Uint8Array): void {
  const svg = Buffer.from(bytes).toString("utf8");
  if (!/<svg(?:\s|>)/i.test(svg)) throw new Error("file is not a valid SVG image");
  if (
    /<!DOCTYPE|<!ENTITY|<script|<foreignObject|<iframe|<object|<embed|<link|<\?xml-stylesheet/i.test(
      svg,
    ) ||
    /\son[a-z]+\s*=/i.test(svg) ||
    /(?:href|xlink:href)\s*=\s*["'](?!\s*#)/i.test(svg) ||
    /(?:href|xlink:href)\s*=\s*[^"'\s>]/i.test(svg) ||
    /url\s*\(\s*["']?\s*(?:data:|https?:|\/\/)/i.test(svg) ||
    /@import/i.test(svg)
  ) {
    throw new Error("SVG contains unsupported active or external content");
  }
}

function detectImage(bytes: Uint8Array): DetectedImage {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { extension: "png", mimeType: "image/png" };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { extension: "jpg", mimeType: "image/jpeg" };
  }
  if (ascii(bytes, 0, 4) === "GIF8" && ["7a", "9a"].includes(ascii(bytes, 4, 6))) {
    return { extension: "gif", mimeType: "image/gif" };
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return { extension: "webp", mimeType: "image/webp" };
  }
  if (
    ascii(bytes, 4, 8) === "ftyp" &&
    /avif|avis/.test(ascii(bytes, 8, Math.min(bytes.length, 40)))
  ) {
    return { extension: "avif", mimeType: "image/avif" };
  }

  const prefix = Buffer.from(bytes.subarray(0, Math.min(bytes.length, 4096)))
    .toString("utf8")
    .replace(/^\uFEFF/, "");
  if (/<svg(?:\s|>)/i.test(prefix)) {
    assertSafeSvg(bytes);
    return { extension: "svg", mimeType: "image/svg+xml" };
  }

  throw new Error("unsupported image format");
}

function sanitizeBaseName(fileName: string): string {
  const raw = path.parse(path.basename(fileName)).name;
  return (
    raw
      .normalize("NFKD")
      .replace(/[^\x00-\x7F]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "image"
  );
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { status },
  );
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return errorResponse("image assets can only be uploaded while running npm run dev", 403);
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return errorResponse("file is required", 400);
    if (file.size === 0) return errorResponse("image file is empty", 400);
    if (file.size > MAX_FILE_SIZE) {
      return errorResponse("image file must be 10 MiB or smaller", 413);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectImage(bytes);
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 20);
    const suffix = `-${hash}.${detected.extension}`;

    await fs.promises.mkdir(ASSET_DIR, { recursive: true });
    const existing = (await fs.promises.readdir(ASSET_DIR)).find((name) =>
      name.endsWith(suffix),
    );
    const fileName =
      existing ?? `${sanitizeBaseName(file.name)}${suffix}`;
    const destination = path.join(ASSET_DIR, fileName);

    if (!existing) {
      await fs.promises.writeFile(destination, bytes, { flag: "wx" });
    }

    return NextResponse.json({
      ok: true,
      asset: {
        src: `/map-assets/${fileName}`,
        name: fileName,
        size: file.size,
        mimeType: detected.mimeType,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "image upload failed";
    return errorResponse(message, 400);
  }
}
