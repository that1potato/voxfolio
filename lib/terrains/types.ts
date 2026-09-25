import type { ThemeColorPair } from "@/lib/theme-colors";

export type BlockTypeId = string;

export interface BlockTypeDefinition {
  id: BlockTypeId;
  label: string;
  appearance: ThemeColorPair;
}

export interface BlockTypesDoc {
  version: number;
  defaultBlockTypeId: BlockTypeId;
  blockTypes: BlockTypeDefinition[];
}

export interface TerrainLayer {
  y: number;
  masks: Record<BlockTypeId, string[]>;
}

export interface TerrainGrid {
  width: number;
  depth: number;
  originX: number;
  originZ: number;
  layers: TerrainLayer[];
}

export type ElementOrientation = "ground" | "upright";

interface ElementBase {
  id: string;
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
  orientation: ElementOrientation;
}

export interface TextElementAppearance {
  color?: ThemeColorPair;
}

export interface ButtonElementAppearance {
  main?: ThemeColorPair;
  text?: ThemeColorPair;
  edge?: ThemeColorPair;
}

export interface CounterElementAppearance {
  /** Glowing digit (Nixie filament) color. */
  glow?: ThemeColorPair;
  /** Optional translucent tube tint behind each digit. */
  glass?: ThemeColorPair;
}

export type ImageSide = "left" | "right";
export type ButtonContentMode = "caption" | "image" | "captionImage";
export type SurfaceFace = "top" | "bottom" | "north" | "south" | "east" | "west";

export interface ImageSurfaceAnchor {
  block: TerrainBlockPosition;
  face: SurfaceFace;
  offset?: number;
}

export interface MapImageAttachment {
  src: string;
  alt: string;
  side: ImageSide;
  size: number;
  gap?: number;
}

export interface TitleElement extends ElementBase {
  type: "title";
  text: string;
  appearance?: TextElementAppearance;
  image?: MapImageAttachment;
}

export interface CaptionElement extends ElementBase {
  type: "caption";
  text: string;
  appearance?: TextElementAppearance;
  image?: MapImageAttachment;
}

export interface ButtonElement extends ElementBase {
  type: "button";
  text: string;
  appearance?: ButtonElementAppearance;
  contentMode?: ButtonContentMode;
  contentPadding?: number;
  image?: MapImageAttachment;
  width?: number;
  depth?: number;
  targetTerrainId?: string | null;
  contentSectionId?: string | null;
  contentItemSlug?: string | null;
  href?: string | null;
  /**
   * Optional list-section item, as `"<sectionId>/<itemSlug>"` (e.g.
   * `"projects/my-project"`). When set, hovering this button shows a small
   * info card built from that item's frontmatter (category, summary, tech).
   * Orthogonal to the click action above.
   */
  hoverCardItem?: string | null;
}

export interface ImageElement extends ElementBase {
  type: "image";
  src: string;
  alt: string;
  width: number;
  height: number;
  opacity?: number;
  surface?: ImageSurfaceAnchor;
}

export interface CounterElement extends ElementBase {
  type: "counter";
  /** Zero-padded digit width. Default 6. */
  digits?: number;
  /** Static number to display (non-negative integer). Default 0. */
  value?: number;
  /**
   * Optional URL (root-relative path or https) fetched once per page load; a
   * JSON response of `{ "count": number }` replaces `value` when it arrives.
   * Lets you back the counter with any API — a visitor counter, stars, etc.
   */
  endpoint?: string;
  appearance?: CounterElementAppearance;
}

export type TerrainElement =
  | TitleElement
  | CaptionElement
  | ButtonElement
  | ImageElement
  | CounterElement;

export type TerrainElementPatch = Partial<{
  position: TerrainBlockPosition;
  scale: number;
  rotationY: number;
  orientation: ElementOrientation;
  text: string;
  appearance: TextElementAppearance | ButtonElementAppearance | CounterElementAppearance;
  digits: number;
  value: number | undefined;
  endpoint: string | undefined;
  contentMode: ButtonContentMode;
  contentPadding: number;
  image: MapImageAttachment;
  width: number;
  depth: number;
  targetTerrainId: string | null;
  contentSectionId: string | null;
  contentItemSlug: string | null;
  href: string | null;
  hoverCardItem: string | null;
  src: string;
  alt: string;
  height: number;
  opacity: number;
  surface: ImageSurfaceAnchor;
}>;

export interface Terrain {
  id: string;
  label: string;
  /**
   * Optional atmosphere preset id from `atmosphere.config.ts` (e.g. `"dusk"`).
   * Overrides the sky backdrop, water, and generated-surroundings palette in
   * both light and dark mode. Omit for the default light/dark look.
   */
  atmosphere?: string;
  grid: TerrainGrid;
  elements: TerrainElement[];
}

export type TerrainBlockPosition = [number, number, number];

export interface TerrainBlock {
  position: TerrainBlockPosition;
  blockTypeId: BlockTypeId;
}

export interface TerrainsDoc {
  version: number;
  rootTerrainId: string;
  terrains: Terrain[];
}

export interface TerrainsManifest {
  version: number;
  rootTerrainId: string;
  terrainIds: string[];
}

export interface MapData {
  blockTypes: BlockTypesDoc;
  terrains: TerrainsDoc;
  surroundings?: Record<string, import("../surroundings/types").GeneratedSurroundings>;
}
