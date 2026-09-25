import type { ThemeColorPair } from "@/lib/theme-colors";
import type {
  BlockTypesDoc,
  ButtonContentMode,
  ButtonElement,
  ElementOrientation,
  ImageSide,
  ImageSurfaceAnchor,
  MapData,
  MapImageAttachment,
  SurfaceFace,
  Terrain,
  TerrainBlockPosition,
  TerrainElement,
  TerrainsDoc,
  TerrainsManifest,
} from "./types";

export const TERRAIN_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const BLOCK_TYPE_ID_PATTERN = TERRAIN_ID_PATTERN;

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const IMAGE_SIDES = new Set<ImageSide>(["left", "right"]);
const BUTTON_CONTENT_MODES = new Set<ButtonContentMode>([
  "caption",
  "image",
  "captionImage",
]);
const SURFACE_FACES = new Set<SurfaceFace>([
  "top",
  "bottom",
  "north",
  "south",
  "east",
  "west",
]);
const ELEMENT_ORIENTATIONS = new Set<ElementOrientation>(["ground", "upright"]);
const MAX_IMAGE_DIMENSION = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Reject ASCII control characters (code points 0x00–0x1f) and backslashes —
 * neither belongs in a URL and both can smuggle values past naive parsers.
 */
function hasUnsupportedUrlChar(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x5c) return true; // 0x5c = backslash
  }
  return false;
}

function assertFiniteNumber(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number`);
  }
}

function assertPositiveImageDimension(
  value: unknown,
  path: string,
): asserts value is number {
  assertFiniteNumber(value, path);
  if (value <= 0 || value > MAX_IMAGE_DIMENSION) {
    throw new Error(`${path} must be greater than zero and at most ${MAX_IMAGE_DIMENSION}`);
  }
}

function assertHexColor(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || !HEX_COLOR_PATTERN.test(value)) {
    throw new Error(`${path} must be a six-digit hex color`);
  }
}

function validateThemeColorPair(
  value: unknown,
  path: string,
): asserts value is ThemeColorPair {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  assertHexColor(value.light, `${path}.light`);
  assertHexColor(value.dark, `${path}.dark`);
}

export function validateImageSource(
  value: unknown,
  path = "image source",
): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new Error(`${path} must be a non-empty URL without surrounding whitespace`);
  }
  if (hasUnsupportedUrlChar(value)) {
    throw new Error(`${path} contains unsupported characters`);
  }
  if (value.startsWith("/") && !value.startsWith("//")) return;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${path} must be root-relative or use HTTPS`);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${path} must be root-relative or use HTTPS`);
  }
}

export function validateButtonHref(
  value: unknown,
  path = "button href",
): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new Error(`${path} must be a non-empty URL without surrounding whitespace`);
  }
  if (hasUnsupportedUrlChar(value)) {
    throw new Error(`${path} contains unsupported characters`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${path} must use HTTPS or mailto`);
  }

  if (url.protocol === "https:") {
    if (url.username || url.password) {
      throw new Error(`${path} must not include credentials`);
    }
    return;
  }

  if (url.protocol === "mailto:") return;

  throw new Error(`${path} must use HTTPS or mailto`);
}

function validateImageAttachment(
  value: unknown,
  path: string,
): asserts value is MapImageAttachment {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  validateImageSource(value.src, `${path} src`);
  if (typeof value.alt !== "string") throw new Error(`${path} alt must be a string`);
  if (typeof value.side !== "string" || !IMAGE_SIDES.has(value.side as ImageSide)) {
    throw new Error(`${path} side must be "left" or "right"`);
  }
  assertPositiveImageDimension(value.size, `${path} size`);
  if (value.gap !== undefined) {
    assertFiniteNumber(value.gap, `${path} gap`);
    if (value.gap < 0 || value.gap > MAX_IMAGE_DIMENSION) {
      throw new Error(`${path} gap must be between zero and ${MAX_IMAGE_DIMENSION}`);
    }
  }
}

function validateTerrainBlockPosition(
  value: unknown,
  path: string,
): asserts value is TerrainBlockPosition {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`${path} must contain exactly three numbers`);
  }
  value.forEach((coordinate, coordinateIndex) =>
    assertFiniteNumber(coordinate, `${path}[${coordinateIndex}]`),
  );
}

function validateImageSurfaceAnchor(
  value: unknown,
  path: string,
): asserts value is ImageSurfaceAnchor {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  validateTerrainBlockPosition(value.block, `${path}.block`);
  if (typeof value.face !== "string" || !SURFACE_FACES.has(value.face as SurfaceFace)) {
    throw new Error(`${path}.face must be a supported exposed face`);
  }
  if (value.offset !== undefined) {
    assertFiniteNumber(value.offset, `${path}.offset`);
    if (value.offset < 0 || value.offset > 5) {
      throw new Error(`${path}.offset must be between zero and 5`);
    }
  }
}

export function getButtonContentMode(element: ButtonElement): ButtonContentMode {
  if (element.contentMode) return element.contentMode;
  if (element.image && element.text.trim().length > 0) return "captionImage";
  if (element.image && element.text.trim().length === 0) return "image";
  return "caption";
}

export function validateTerrainId(id: unknown, path = "terrain id"): asserts id is string {
  if (typeof id !== "string" || !TERRAIN_ID_PATTERN.test(id) || id === "index") {
    throw new Error(`${path} must use lowercase letters, numbers, and single hyphens`);
  }
}

export function validateBlockTypeId(
  id: unknown,
  path = "block type id",
): asserts id is string {
  if (typeof id !== "string" || !BLOCK_TYPE_ID_PATTERN.test(id)) {
    throw new Error(`${path} must use lowercase letters, numbers, and single hyphens`);
  }
}

export function validateBlockTypes(value: unknown): asserts value is BlockTypesDoc {
  if (!isRecord(value)) throw new Error("block types document must be an object");
  if (value.version !== 2) throw new Error("block types document version must be 2");
  validateBlockTypeId(value.defaultBlockTypeId, "defaultBlockTypeId");
  if (!Array.isArray(value.blockTypes) || value.blockTypes.length === 0) {
    throw new Error("blockTypes must be a non-empty array");
  }

  const ids = new Set<string>();
  value.blockTypes.forEach((blockType, index) => {
    const path = `blockTypes[${index}]`;
    if (!isRecord(blockType)) throw new Error(`${path} must be an object`);
    validateBlockTypeId(blockType.id, `${path}.id`);
    if (ids.has(blockType.id)) {
      throw new Error(`block type id "${blockType.id}" is duplicated`);
    }
    ids.add(blockType.id);
    if (typeof blockType.label !== "string" || blockType.label.trim().length === 0) {
      throw new Error(`${path}.label must be a non-empty string`);
    }
    if (!isRecord(blockType.appearance)) {
      throw new Error(`${path}.appearance must be an object`);
    }
    validateThemeColorPair(blockType.appearance, `${path}.appearance`);
  });

  if (!ids.has(value.defaultBlockTypeId)) {
    throw new Error("defaultBlockTypeId must reference an existing block type");
  }
}

function validateTerrainElements(value: unknown): asserts value is TerrainElement[] {
  if (!Array.isArray(value)) throw new Error("terrain elements must be an array");
  const elementIds = new Set<string>();
  value.forEach((element, index) => {
    const path = `terrain element ${index}`;
    if (!isRecord(element)) throw new Error(`${path} must be an object`);
    if (typeof element.id !== "string" || element.id.trim().length === 0) {
      throw new Error(`${path} id must be a non-empty string`);
    }
    if (elementIds.has(element.id)) {
      throw new Error(`terrain element id "${element.id}" is duplicated`);
    }
    elementIds.add(element.id);
    if (
      element.type !== "title" &&
      element.type !== "caption" &&
      element.type !== "button" &&
      element.type !== "image" &&
      element.type !== "counter"
    ) {
      throw new Error(`${path} has an unsupported type`);
    }
    if (!Array.isArray(element.position) || element.position.length !== 3) {
      throw new Error(`${path} position must contain exactly three numbers`);
    }
    element.position.forEach((coordinate, coordinateIndex) =>
      assertFiniteNumber(coordinate, `${path} position[${coordinateIndex}]`),
    );
    if (element.scale !== undefined) {
      assertFiniteNumber(element.scale, `${path} scale`);
      if (element.scale <= 0) {
        throw new Error(`${path} scale must be greater than zero`);
      }
    }
    if (element.rotationY !== undefined) {
      assertFiniteNumber(element.rotationY, `${path} rotationY`);
    }
    if (
      typeof element.orientation !== "string" ||
      !ELEMENT_ORIENTATIONS.has(element.orientation as ElementOrientation)
    ) {
      throw new Error(`${path} orientation must be "ground" or "upright"`);
    }

    if (
      element.type === "title" ||
      element.type === "caption" ||
      element.type === "button"
    ) {
      if (typeof element.text !== "string") {
        throw new Error(`${path} text must be a string`);
      }
      if (element.image !== undefined) {
        validateImageAttachment(element.image, `${path} image`);
      }
    }

    if (element.type === "title" || element.type === "caption") {
      if (element.appearance !== undefined) {
        if (!isRecord(element.appearance)) {
          throw new Error(`${path} appearance must be an object`);
        }
        if (element.appearance.color !== undefined) {
          validateThemeColorPair(
            element.appearance.color,
            `${path} appearance.color`,
          );
        }
      }
    }

    if (element.type === "button") {
      if (element.appearance !== undefined) {
        const appearance = element.appearance;
        if (!isRecord(appearance)) {
          throw new Error(`${path} appearance must be an object`);
        }
        (["main", "text", "edge"] as const).forEach((role) => {
          if (appearance[role] !== undefined) {
            validateThemeColorPair(
              appearance[role],
              `${path} appearance.${role}`,
            );
          }
        });
      }
      if (
        element.contentMode !== undefined &&
        (typeof element.contentMode !== "string" ||
          !BUTTON_CONTENT_MODES.has(element.contentMode as ButtonContentMode))
      ) {
        throw new Error(`${path} contentMode must be "caption", "image", or "captionImage"`);
      }
      if (element.contentPadding !== undefined) {
        assertFiniteNumber(element.contentPadding, `${path} contentPadding`);
        if (element.contentPadding < 0 || element.contentPadding > MAX_IMAGE_DIMENSION) {
          throw new Error(`${path} contentPadding must be between zero and ${MAX_IMAGE_DIMENSION}`);
        }
      }
      const contentMode = getButtonContentMode(element as unknown as ButtonElement);
      if (contentMode === "image" || contentMode === "captionImage") {
        if (!element.image) {
          throw new Error(`${path} must include an image for its content mode`);
        }
      }
      if (contentMode === "image" && element.contentMode === "image") {
        if (typeof element.text !== "string" || element.text.trim().length === 0) {
          throw new Error(`${path} text must provide a semantic label`);
        }
      }
      if (element.width !== undefined) {
        assertFiniteNumber(element.width, `${path} width`);
        if (element.width <= 0) throw new Error(`${path} width must be greater than zero`);
      }
      if (element.depth !== undefined) {
        assertFiniteNumber(element.depth, `${path} depth`);
        if (element.depth <= 0) throw new Error(`${path} depth must be greater than zero`);
      }
      if (
        element.targetTerrainId !== undefined &&
        element.targetTerrainId !== null
      ) {
        validateTerrainId(element.targetTerrainId, `${path} targetTerrainId`);
      }
      if (
        element.contentSectionId !== undefined &&
        element.contentSectionId !== null &&
        typeof element.contentSectionId !== "string"
      ) {
        throw new Error(`${path} contentSectionId must be a string or null`);
      }
      if (
        element.contentItemSlug !== undefined &&
        element.contentItemSlug !== null
      ) {
        if (
          typeof element.contentItemSlug !== "string" ||
          element.contentItemSlug.trim().length === 0 ||
          element.contentItemSlug.trim() !== element.contentItemSlug
        ) {
          throw new Error(`${path} contentItemSlug must be a non-empty string or null`);
        }
        if (!element.contentSectionId) {
          throw new Error(`${path} contentItemSlug requires contentSectionId`);
        }
      }
      if (element.href !== undefined && element.href !== null) {
        validateButtonHref(element.href, `${path} href`);
      }
      if (
        element.hoverCardItem !== undefined &&
        element.hoverCardItem !== null
      ) {
        if (
          typeof element.hoverCardItem !== "string" ||
          element.hoverCardItem.trim().length === 0 ||
          element.hoverCardItem.trim() !== element.hoverCardItem
        ) {
          throw new Error(`${path} hoverCardItem must be a non-empty string or null`);
        }
        const [sectionId, itemSlug, ...rest] = element.hoverCardItem.split("/");
        if (!sectionId || !itemSlug || rest.length > 0) {
          throw new Error(`${path} hoverCardItem must look like "<sectionId>/<itemSlug>"`);
        }
      }
      const actionCount = [
        element.targetTerrainId,
        element.contentSectionId,
        element.href,
      ].filter((value) => value !== undefined && value !== null && value !== "").length;
      if (actionCount > 1) {
        throw new Error(
          `${path} must define only one of targetTerrainId, contentSectionId, or href`,
        );
      }
    }

    if (element.type === "counter") {
      if (element.digits !== undefined) {
        if (!Number.isInteger(element.digits) || (element.digits as number) < 1 || (element.digits as number) > 12) {
          throw new Error(`${path} digits must be an integer between 1 and 12`);
        }
      }
      if (element.value !== undefined) {
        if (!Number.isSafeInteger(element.value) || (element.value as number) < 0) {
          throw new Error(`${path} value must be a non-negative integer`);
        }
      }
      if (element.endpoint !== undefined) {
        // Same rule as image sources: root-relative path or HTTPS URL.
        validateImageSource(element.endpoint, `${path} endpoint`);
      }
      if (element.appearance !== undefined) {
        const appearance = element.appearance;
        if (!isRecord(appearance)) {
          throw new Error(`${path} appearance must be an object`);
        }
        (["glow", "glass"] as const).forEach((role) => {
          if (appearance[role] !== undefined) {
            validateThemeColorPair(appearance[role], `${path} appearance.${role}`);
          }
        });
      }
    }

    if (element.type === "image") {
      validateImageSource(element.src, `${path} src`);
      if (typeof element.alt !== "string") throw new Error(`${path} alt must be a string`);
      assertPositiveImageDimension(element.width, `${path} width`);
      assertPositiveImageDimension(element.height, `${path} height`);
      if (element.opacity !== undefined) {
        assertFiniteNumber(element.opacity, `${path} opacity`);
        if (element.opacity < 0 || element.opacity > 1) {
          throw new Error(`${path} opacity must be between zero and one`);
        }
      }
      if (element.surface !== undefined) {
        validateImageSurfaceAnchor(element.surface, `${path} surface`);
      }
    }
  });
}

export function validateTerrain(
  value: unknown,
  blockTypeIds?: ReadonlySet<string>,
): asserts value is Terrain {
  if (!isRecord(value)) throw new Error("terrain must be an object");

  validateTerrainId(value.id);
  if (typeof value.label !== "string" || value.label.trim().length === 0) {
    throw new Error("terrain label must be a non-empty string");
  }
  // Unknown atmosphere ids are allowed; they just render the default look.
  if (
    value.atmosphere !== undefined &&
    (typeof value.atmosphere !== "string" || !TERRAIN_ID_PATTERN.test(value.atmosphere))
  ) {
    throw new Error("terrain atmosphere must use lowercase letters, numbers, and single hyphens");
  }
  if (!isRecord(value.grid)) throw new Error("terrain grid must be an object");

  const { width, depth, originX, originZ, layers } = value.grid;
  if (!Number.isInteger(width) || (width as number) < 1 || (width as number) > 200) {
    throw new Error("terrain grid width must be an integer between 1 and 200");
  }
  if (!Number.isInteger(depth) || (depth as number) < 1 || (depth as number) > 200) {
    throw new Error("terrain grid depth must be an integer between 1 and 200");
  }
  assertFiniteNumber(originX, "terrain grid originX");
  assertFiniteNumber(originZ, "terrain grid originZ");
  if (!Array.isArray(layers)) throw new Error("terrain grid layers must be an array");

  const layerYs = new Set<number>();
  layers.forEach((layer, layerIndex) => {
    const path = `terrain grid layers[${layerIndex}]`;
    if (!isRecord(layer)) throw new Error(`${path} must be an object`);
    if (!Number.isInteger(layer.y)) throw new Error(`${path}.y must be an integer`);
    if (layerYs.has(layer.y as number)) {
      throw new Error(`terrain grid layer y=${layer.y} is duplicated`);
    }
    layerYs.add(layer.y as number);
    if (!isRecord(layer.masks) || Object.keys(layer.masks).length === 0) {
      throw new Error(`${path}.masks must contain at least one block type`);
    }

    const occupied = new Set<number>();
    Object.entries(layer.masks).forEach(([blockTypeId, rows]) => {
      validateBlockTypeId(blockTypeId, `${path}.masks block type id`);
      if (blockTypeIds && !blockTypeIds.has(blockTypeId)) {
        throw new Error(`${path}.masks references unknown block type "${blockTypeId}"`);
      }
      if (!Array.isArray(rows) || rows.length !== depth) {
        throw new Error(`${path}.masks.${blockTypeId} must contain ${depth} rows`);
      }
      let containsBlock = false;
      rows.forEach((row, rowIndex) => {
        if (typeof row !== "string" || row.length !== width || !/^[01]+$/.test(row)) {
          throw new Error(
            `${path}.masks.${blockTypeId}[${rowIndex}] must contain ${width} zero-or-one cells`,
          );
        }
        for (let columnIndex = 0; columnIndex < width; columnIndex++) {
          if (row[columnIndex] !== "1") continue;
          containsBlock = true;
          const cellIndex = rowIndex * width + columnIndex;
          if (occupied.has(cellIndex)) {
            throw new Error(`${path} has overlapping block masks at cell ${columnIndex},${rowIndex}`);
          }
          occupied.add(cellIndex);
        }
      });
      if (!containsBlock) {
        throw new Error(`${path}.masks.${blockTypeId} must contain at least one block`);
      }
    });
  });

  validateTerrainElements(value.elements);
}

export function validateTerrainsManifest(
  value: unknown,
): asserts value is TerrainsManifest {
  if (!isRecord(value)) throw new Error("terrain manifest must be an object");
  if (value.version !== 2) throw new Error("terrain manifest version must be 2");
  validateTerrainId(value.rootTerrainId, "terrain manifest rootTerrainId");
  if (!Array.isArray(value.terrainIds) || value.terrainIds.length === 0) {
    throw new Error("terrain manifest terrainIds must be a non-empty array");
  }
  const ids = new Set<string>();
  value.terrainIds.forEach((id, index) => {
    validateTerrainId(id, `terrain manifest terrainIds[${index}]`);
    if (ids.has(id)) throw new Error(`terrain manifest id "${id}" is duplicated`);
    ids.add(id);
  });
  if (!ids.has(value.rootTerrainId)) {
    throw new Error("terrain manifest rootTerrainId must appear in terrainIds");
  }
}

export function validateTerrains(
  value: unknown,
  blockTypeIds?: ReadonlySet<string>,
): asserts value is TerrainsDoc {
  if (!isRecord(value)) throw new Error("terrains document must be an object");
  if (value.version !== 2) throw new Error("terrains document version must be 2");
  validateTerrainId(value.rootTerrainId, "terrains document rootTerrainId");
  if (!Array.isArray(value.terrains) || value.terrains.length === 0) {
    throw new Error("terrains document terrains must be a non-empty array");
  }
  const ids = new Set<string>();
  value.terrains.forEach((terrain) => {
    validateTerrain(terrain, blockTypeIds);
    if (ids.has(terrain.id)) throw new Error(`terrain id "${terrain.id}" is duplicated`);
    ids.add(terrain.id);
  });
  if (!ids.has(value.rootTerrainId)) {
    throw new Error("terrains document rootTerrainId must match a terrain");
  }
}

export function validateMapData(value: unknown): asserts value is MapData {
  if (!isRecord(value)) throw new Error("map data must be an object");
  validateBlockTypes(value.blockTypes);
  const blockTypeIds = new Set(value.blockTypes.blockTypes.map((blockType) => blockType.id));
  validateTerrains(value.terrains, blockTypeIds);
}
