"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EDGE_MARGIN, useEditorStore } from "@/lib/editor-store";
import { getTerrainContentBounds, getGroundLayer, layerToCells } from "@/lib/terrains";
import { darkenHexColor, resolveThemeColor } from "@/lib/theme-colors";
import type { SiteThemeMode } from "@/theme.config";

type Tool = "paint" | "erase";

const CELL_PX = 12;

export function TilePainter({ themeMode }: { themeMode: SiteThemeMode }) {
  const doc = useEditorStore((state) => state.doc);
  const blockTypes = useEditorStore((state) => state.blockTypes);
  const activeTerrainId = useEditorStore((state) => state.activeTerrainId);
  const activeBlockTypeId = useEditorStore((state) => state.activeBlockTypeId);
  const setGroundCells = useEditorStore((state) => state.setGroundCells);
  const terrain = doc.terrains.find((item) => item.id === activeTerrainId);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buffer = useRef<Array<string | null> | null>(null);
  const strokeMode = useRef<Tool | null>(null);

  const [tool, setTool] = useState<Tool>("paint");
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);
  const [tick, setTick] = useState(0);
  const forceRedraw = () => setTick((value) => value + 1);

  const width = terrain?.grid.width ?? 0;
  const depth = terrain?.grid.depth ?? 0;

  useEffect(() => {
    if (!terrain) return;
    buffer.current = layerToCells(getGroundLayer(terrain), width, depth);
    forceRedraw();
  }, [activeTerrainId, width, depth, terrain]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !terrain || !buffer.current) return;
    canvas.width = width * CELL_PX;
    canvas.height = depth * CELL_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const definitions = new Map(
      blockTypes.blockTypes.map((blockType) => [blockType.id, blockType]),
    );
    const cells = buffer.current;
    ctx.fillStyle = "#0e0a08";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Compute content bounds (in grid cell indices) to identify margin ring
    const contentBounds = getTerrainContentBounds(terrain);
    const contentMinI = contentBounds ? contentBounds.minX - terrain.grid.originX : null;
    const contentMaxI = contentBounds ? contentBounds.maxX - terrain.grid.originX : null;
    const contentMinJ = contentBounds ? contentBounds.minZ - terrain.grid.originZ : null;
    const contentMaxJ = contentBounds ? contentBounds.maxZ - terrain.grid.originZ : null;

    const isMarginCell = (i: number, j: number): boolean => {
      if (contentMinI === null) return true;
      return (
        i < contentMinI - EDGE_MARGIN + EDGE_MARGIN ||
        i > contentMaxI! + EDGE_MARGIN - EDGE_MARGIN ||
        j < contentMinJ! - EDGE_MARGIN + EDGE_MARGIN ||
        j > contentMaxJ! + EDGE_MARGIN - EDGE_MARGIN ||
        (i < contentMinI || i > contentMaxI! || j < contentMinJ! || j > contentMaxJ!)
      );
    };

    for (let j = 0; j < depth; j++) {
      for (let i = 0; i < width; i++) {
        const blockTypeId = cells[j * width + i];
        const x = i * CELL_PX;
        const y = j * CELL_PX;
        const inMargin = isMarginCell(i, j);
        if (blockTypeId) {
          const blockType = definitions.get(blockTypeId);
          const isPerimeter =
            i === 0 ||
            i === width - 1 ||
            j === 0 ||
            j === depth - 1 ||
            !cells[j * width + (i - 1)] ||
            !cells[j * width + (i + 1)] ||
            !cells[(j - 1) * width + i] ||
            !cells[(j + 1) * width + i];
          ctx.fillStyle = blockType
            ? isPerimeter
              ? darkenHexColor(
                  resolveThemeColor(blockType.appearance, themeMode),
                )
              : resolveThemeColor(blockType.appearance, themeMode)
            : "#ff00ff";
          ctx.fillRect(x, y, CELL_PX - 1, CELL_PX - 1);
        } else if (inMargin) {
          // Margin ring: subtle dotted indicator so it's visually distinct
          ctx.fillStyle = "#2a2018";
          ctx.fillRect(x, y, CELL_PX - 1, CELL_PX - 1);
          ctx.fillStyle = "#3a3028";
          ctx.fillRect(x + 1, y + 1, 1, 1);
          ctx.fillRect(x + CELL_PX - 3, y + CELL_PX - 3, 1, 1);
        } else {
          ctx.fillStyle = "#1a1410";
          ctx.fillRect(x + CELL_PX / 2 - 1, y + CELL_PX / 2 - 1, 2, 2);
        }
      }
    }

    if (hover) {
      ctx.strokeStyle = "#f5f1e6";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        hover.i * CELL_PX + 1,
        hover.j * CELL_PX + 1,
        CELL_PX - 2,
        CELL_PX - 2,
      );
    }
  }, [blockTypes, hover, tick, width, depth, terrain, themeMode]);

  const cellAt = useCallback(
    (event: React.MouseEvent): { i: number; j: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const i = Math.floor((event.clientX - rect.left) / CELL_PX);
      const j = Math.floor((event.clientY - rect.top) / CELL_PX);
      if (i < 0 || i >= width || j < 0 || j >= depth) return null;
      return { i, j };
    },
    [width, depth],
  );

  const setCell = (i: number, j: number, nextTool: Tool) => {
    if (!buffer.current) return;
    buffer.current[j * width + i] =
      nextTool === "paint" ? activeBlockTypeId : null;
  };

  const commitBuffer = () => {
    if (!buffer.current || !terrain) return;
    setGroundCells(activeTerrainId, [...buffer.current]);
  };

  const handleDown = (event: React.MouseEvent) => {
    const cell = cellAt(event);
    if (!cell) return;
    strokeMode.current = tool;
    setCell(cell.i, cell.j, tool);
    forceRedraw();
  };

  const handleMove = (event: React.MouseEvent) => {
    const cell = cellAt(event);
    setHover(cell);
    if (!cell || !strokeMode.current) return;
    setCell(cell.i, cell.j, strokeMode.current);
    forceRedraw();
  };

  const finishStroke = () => {
    if (!strokeMode.current) return;
    strokeMode.current = null;
    commitBuffer();
  };

  const fillAll = () => {
    if (!buffer.current) return;
    buffer.current.fill(activeBlockTypeId);
    commitBuffer();
    forceRedraw();
  };

  const clearAll = () => {
    if (!buffer.current) return;
    buffer.current.fill(null);
    commitBuffer();
    forceRedraw();
  };

  if (!terrain) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-block text-xs uppercase tracking-widest text-cream/60">
        Ground Painter
      </h3>

      <div className="flex flex-wrap items-center gap-1">
        <button
          onClick={() => setTool("paint")}
          className={`px-2 py-1 font-block text-[10px] uppercase ${
            tool === "paint"
              ? "bg-cream text-charcoal"
              : "border border-cream/30 bg-charcoal text-cream hover:bg-cream/10"
          }`}
        >
          Paint
        </button>
        <button
          onClick={() => setTool("erase")}
          className={`px-2 py-1 font-block text-[10px] uppercase ${
            tool === "erase"
              ? "bg-cream text-charcoal"
              : "border border-cream/30 bg-charcoal text-cream hover:bg-cream/10"
          }`}
        >
          Erase
        </button>
        <button
          onClick={fillAll}
          className="border border-cream/30 bg-charcoal px-2 py-1 font-block text-[10px] uppercase text-cream hover:bg-cream/10"
        >
          Fill
        </button>
        <button
          onClick={clearAll}
          className="border border-cream/30 bg-charcoal px-2 py-1 font-block text-[10px] uppercase text-cream hover:bg-cream/10"
        >
          Clear
        </button>
      </div>

      <div className="overflow-auto rounded border border-cream/20">
        <canvas
          ref={canvasRef}
          onMouseDown={handleDown}
          onMouseMove={handleMove}
          onMouseUp={finishStroke}
          onMouseLeave={() => {
            finishStroke();
            setHover(null);
          }}
          className="block cursor-crosshair"
        />
      </div>

      <div className="font-mono text-[10px] text-cream/60">
        {hover
          ? `cell (${hover.i}, ${hover.j}) · world (${terrain.grid.originX + hover.i}, ${terrain.grid.originZ + hover.j})`
          : `painting y=0 with ${activeBlockTypeId}`}
      </div>

      <div className="mt-1 font-mono text-[10px] text-cream/40">
        {width}×{depth} grid · auto-resizes · margin ring = {EDGE_MARGIN}
      </div>
    </div>
  );
}
