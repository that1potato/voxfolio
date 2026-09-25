import { Vector3 } from "three";
import {
  getButtonContentMode,
  type ElementOrientation,
  type TerrainElement,
} from "@/lib/terrains";
import {
  BUTTON_DEFAULT_THICKNESS,
  getAttachedContentLayout,
  getButtonContentLayout,
  getOrientedBoxPoints,
  getSurfaceImagePosition,
  type Vector3Tuple,
} from "./element-layout";
import { levels } from "./text/typography";
import { measureVoxelText } from "./text/measure";
import { DEFAULT_COUNTER_DIGITS } from "@/lib/map-element-appearance";

export interface ElementBox {
  position: Vector3Tuple;
  rotationY: number;
  orientation: ElementOrientation;
  center: Vector3Tuple;
  size: Vector3Tuple;
  scale: number;
}

export function getElementBounds(element: TerrainElement): Vector3[] {
  return getElementBoundsBoxes(element).flatMap((box) =>
    getOrientedBoxPoints(box),
  );
}

export function getElementBoundsBoxes(element: TerrainElement): ElementBox[] {
  const rotationY = element.rotationY ?? 0;
  const scale = element.scale ?? 1;

  if (element.type === "image") {
    return [
      {
        position: element.surface
          ? getSurfaceImagePosition(
              element.surface.block,
              element.surface.face,
              element.surface.offset,
            )
          : element.position,
        rotationY: element.surface ? 0 : rotationY,
        orientation: element.surface ? "upright" : element.orientation,
        center: [0, 0, 0],
        size: [element.width, element.height, 0.02],
        scale,
      },
    ];
  }

  if (element.type === "title" || element.type === "caption") {
    const textScale =
      element.type === "title" ? levels.title.scale : levels.caption.scale;
    const textSize = measureVoxelText(element.text, textScale);
    const layout = getAttachedContentLayout(
      textSize.width,
      textSize.height,
      element.image,
      element.type === "title" ? 0.5 : 0.25,
    );
    const centerY = element.type === "title" ? 0 : textSize.height / 2;
    const contentDepth =
      element.type === "title"
        ? Math.max(0.08, levels.title.scale * levels.title.depth)
        : Math.max(0.08, levels.caption.scale * levels.caption.depth);

    return [
      {
        position: element.position,
        rotationY,
        orientation: element.orientation,
        center: [layout.centerX, centerY, contentDepth / 2],
        size: [layout.totalWidth, layout.height, contentDepth],
        scale,
      },
    ];
  }

  if (element.type === "counter") {
    const digits = element.digits ?? DEFAULT_COUNTER_DIGITS;
    const size = measureVoxelText("0".repeat(digits), levels.counter.scale);
    const contentDepth = Math.max(0.08, levels.counter.scale * levels.counter.depth);
    return [
      {
        position: element.position,
        rotationY,
        orientation: element.orientation,
        center: [0, 0, contentDepth / 2],
        size: [size.width, size.height, contentDepth],
        scale,
      },
    ];
  }

  const width = element.width ?? 7;
  const height = element.depth ?? 1.8;
  const thickness = BUTTON_DEFAULT_THICKNESS;
  const boxes: ElementBox[] = [
    {
      position: element.position,
      rotationY,
      orientation: element.orientation,
      center: [0, 0, 0],
      size: [width, height, thickness],
      scale,
    },
  ];

  if (element.image) {
    const layout = getButtonContentLayout({
      width,
      height,
      image: element.image,
      mode: getButtonContentMode(element),
      contentPadding: element.contentPadding,
    });
    boxes.push({
      position: element.position,
      rotationY,
      orientation: element.orientation,
      center: [layout.imageX, 0, thickness / 2 + 0.03],
      size: [layout.imageSize, layout.imageSize, 0.02],
      scale,
    });
  }

  return boxes;
}

export function getElementSelectionBoxes(element: TerrainElement): ElementBox[] {
  const boxes = getElementBoundsBoxes(element);

  if (element.type === "button") {
    return boxes.map((box, index) => ({
      ...box,
      center:
        index === 0
          ? box.center
          : [box.center[0], box.center[1], box.center[2] + 0.07],
      size:
        index === 0
          ? [box.size[0] + 0.5, box.size[1] + 0.5, 0.8]
          : [box.size[0] + 0.3, box.size[1] + 0.3, 0.16],
    }));
  }

  if (element.type === "image") {
    return boxes.map((box) => ({
      ...box,
      center: [
        box.center[0],
        box.center[1],
        box.center[2] + 0.08,
      ],
      size: [box.size[0] + 0.3, box.size[1] + 0.3, 0.16],
    }));
  }

  if (element.type === "title" || element.type === "caption") {
    const markerDepth =
      element.type === "title"
        ? Math.max(0.5, levels.title.scale * levels.title.depth)
        : 0.16;

    return boxes.map((box) => ({
      ...box,
      center: [box.center[0], box.center[1], markerDepth / 2],
      size: [box.size[0] + 0.4, box.size[1] + 0.4, markerDepth],
    }));
  }

  return boxes.map((box) => ({
    ...box,
    size: [box.size[0] + 0.4, box.size[1] + 0.4, box.size[2]],
  }));
}
