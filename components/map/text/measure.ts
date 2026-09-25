export interface VoxelTextMeasurement {
  width: number;
  height: number;
}

const GLYPH_WIDTH = 5;
const GLYPH_GAP = 1;
const GLYPH_HEIGHT = 7;
const LINE_GAP = 1;

export function measureVoxelText(
  text: string,
  scale: number,
): VoxelTextMeasurement {
  const lines = text.split("\n");
  const maxLineLength = Math.max(1, ...lines.map((line) => line.length));
  const widthAtScaleOne =
    maxLineLength * (GLYPH_WIDTH + GLYPH_GAP) - GLYPH_GAP;
  const heightAtScaleOne =
    lines.length * (GLYPH_HEIGHT + LINE_GAP) - LINE_GAP;

  return {
    width: widthAtScaleOne * scale,
    height: heightAtScaleOne * scale,
  };
}
