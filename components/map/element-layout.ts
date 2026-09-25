import { Vector3 } from "three";
import type {
  ButtonContentMode,
  ElementOrientation,
  MapImageAttachment,
  SurfaceFace,
} from "@/lib/terrains";

export type Vector3Tuple = [number, number, number];

export const BUTTON_DEFAULT_THICKNESS = 0.4;
export const BUTTON_DEFAULT_CONTENT_PADDING = 0.35;
export const DEFAULT_SURFACE_IMAGE_OFFSET = 0.035;

export function getElementPlaneRotation(
  orientation: ElementOrientation,
): Vector3Tuple {
  return orientation === "ground" ? [-Math.PI / 2, 0, 0] : [0, 0, 0];
}

export function getElementFacePosition(
  orientation: ElementOrientation,
  offset: number,
): Vector3Tuple {
  return orientation === "ground" ? [0, offset, 0] : [0, 0, offset];
}

export function getOrientedBoxDimensions(
  orientation: ElementOrientation,
  width: number,
  height: number,
  thickness: number,
): Vector3Tuple {
  return orientation === "ground"
    ? [width, thickness, height]
    : [width, height, thickness];
}

export interface AttachedContentLayout {
  centerX: number;
  height: number;
  imageX: number;
  totalWidth: number;
}

export function getAttachedContentLayout(
  textWidth: number,
  textHeight: number,
  image: MapImageAttachment | undefined,
  defaultGap: number,
): AttachedContentLayout {
  if (!image) {
    return {
      centerX: 0,
      height: textHeight,
      imageX: 0,
      totalWidth: textWidth,
    };
  }

  const direction = image.side === "left" ? -1 : 1;
  const gap = image.gap ?? defaultGap;

  return {
    centerX: direction * (gap + image.size) / 2,
    height: Math.max(textHeight, image.size),
    imageX: direction * (textWidth / 2 + gap + image.size / 2),
    totalWidth: textWidth + gap + image.size,
  };
}

export interface ButtonContentLayout {
  contentWidth: number;
  imageSize: number;
  imageX: number;
  labelHeight: number;
  labelWidth: number;
  labelX: number;
  showImage: boolean;
  showText: boolean;
}

export function getButtonContentLayout({
  width,
  height,
  image,
  mode,
  contentPadding = BUTTON_DEFAULT_CONTENT_PADDING,
}: {
  width: number;
  height: number;
  image: MapImageAttachment | undefined;
  mode: ButtonContentMode;
  contentPadding?: number;
}): ButtonContentLayout {
  const padding = Math.max(0, contentPadding);
  const contentWidth = Math.max(0.2, width - padding * 2);
  const contentHeight = Math.max(0.2, height - padding * 2);
  const showImage = !!image && (mode === "image" || mode === "captionImage");
  const showText = mode === "caption" || mode === "captionImage";
  const imageGap = image?.gap ?? 0.35;
  const imageSize = showImage && image ? Math.min(image.size, contentWidth, contentHeight) : 0;
  const imageReservedWidth = showImage && showText ? imageSize + imageGap : 0;

  return {
    contentWidth,
    imageSize,
    imageX:
      showImage && image && showText
        ? image.side === "left"
          ? -contentWidth / 2 + imageSize / 2
          : contentWidth / 2 - imageSize / 2
        : 0,
    labelHeight: contentHeight,
    labelWidth: Math.max(0.2, contentWidth - imageReservedWidth),
    labelX:
      showImage && image && showText
        ? image.side === "left"
          ? imageReservedWidth / 2
          : -imageReservedWidth / 2
        : 0,
    showImage,
    showText,
  };
}

function orientLocalPoint(
  orientation: ElementOrientation,
  x: number,
  y: number,
  z: number,
): Vector3Tuple {
  return orientation === "ground" ? [x, z, -y] : [x, y, z];
}

export function getOrientedBoxPoints({
  position,
  rotationY,
  orientation,
  center,
  size,
  scale = 1,
}: {
  position: Vector3Tuple;
  rotationY: number;
  orientation: ElementOrientation;
  center: Vector3Tuple;
  size: Vector3Tuple;
  scale?: number;
}): Vector3[] {
  const points: Vector3[] = [];
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);

  for (const x of [
    center[0] - size[0] / 2,
    center[0] + size[0] / 2,
  ]) {
    for (const y of [
      center[1] - size[1] / 2,
      center[1] + size[1] / 2,
    ]) {
      for (const z of [
        center[2] - size[2] / 2,
        center[2] + size[2] / 2,
      ]) {
        const [orientedX, orientedY, orientedZ] = orientLocalPoint(
          orientation,
          x * scale,
          y * scale,
          z * scale,
        );
        points.push(
          new Vector3(
            position[0] + orientedX * cos + orientedZ * sin,
            position[1] + orientedY,
            position[2] - orientedX * sin + orientedZ * cos,
          ),
        );
      }
    }
  }

  return points;
}

export function getSurfaceNormal(face: SurfaceFace): Vector3Tuple {
  switch (face) {
    case "top":
      return [0, 1, 0];
    case "bottom":
      return [0, -1, 0];
    case "east":
      return [1, 0, 0];
    case "west":
      return [-1, 0, 0];
    case "south":
      return [0, 0, 1];
    case "north":
      return [0, 0, -1];
  }
}

export function getSurfacePlaneRotation(face: SurfaceFace): Vector3Tuple {
  switch (face) {
    case "top":
      return [-Math.PI / 2, 0, 0];
    case "bottom":
      return [Math.PI / 2, 0, 0];
    case "east":
      return [0, Math.PI / 2, 0];
    case "west":
      return [0, -Math.PI / 2, 0];
    case "south":
      return [0, 0, 0];
    case "north":
      return [0, Math.PI, 0];
  }
}

export function getSurfaceImagePosition(
  block: Vector3Tuple,
  face: SurfaceFace,
  offset = DEFAULT_SURFACE_IMAGE_OFFSET,
): Vector3Tuple {
  const normal = getSurfaceNormal(face);
  return [
    block[0] + normal[0] * (0.5 + offset),
    block[1] + normal[1] * (0.5 + offset),
    block[2] + normal[2] * (0.5 + offset),
  ];
}
