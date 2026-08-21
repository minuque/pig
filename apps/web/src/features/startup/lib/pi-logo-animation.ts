export type PieceColor = "cyan" | "red" | "green" | "orange";
export type CellColor = PieceColor | "flash" | "theme";
export type CellMap = Record<string, CellColor>;

export interface Piece {
  color: PieceColor;
  cells: ReadonlyArray<readonly [number, number]>;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
}

export const BOARD_W = 8;
export const BOARD_H = 9;
export const CLEAR_ROW = 6;
export const LOGO_FPS = 18;
export const FRAME_MS = 1000 / LOGO_FPS;

export const VISIBLE_COLS = 4;
export const VISIBLE_ROWS = 4;
export const VISIBLE_OFFSET_X = 2;
export const VISIBLE_OFFSET_Y = 3;

export const FINAL_LOGO = [
  "3:2",
  "3:3",
  "3:4",
  "4:2",
  "4:4",
  "5:2",
  "5:3",
  "5:5",
  "6:2",
  "6:5",
] as const;

export const BASE: Piece = {
  color: "orange",
  cells: [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
  ],
  startX: 1,
  startY: -2,
  targetX: 1,
  targetY: 6,
};

export const LEFT: Piece = {
  color: "red",
  cells: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 0],
  ],
  startX: 0,
  startY: -3,
  targetX: 2,
  targetY: 3,
};

export const TOP: Piece = {
  color: "cyan",
  cells: [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
  ],
  startX: 2,
  startY: -2,
  targetX: 2,
  targetY: 2,
};

export const RIGHT: Piece = {
  color: "green",
  cells: [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
  ],
  startX: 5,
  startY: -3,
  targetX: 5,
  targetY: 4,
};

export const LOGO_SEQUENCE: ReadonlyArray<{
  piece: Piece;
  duration: number;
  holdAfter: number;
}> = [
  { piece: BASE, duration: 91, holdAfter: 11 },
  { piece: LEFT, duration: 91, holdAfter: 11 },
  { piece: TOP, duration: 91, holdAfter: 11 },
  { piece: RIGHT, duration: 91, holdAfter: 49 },
];

export const LOGO_TIMING = {
  initialHold: 28,
  clearFlashCount: 5,
  clearFlashStep: 35,
  postClearHold: 49,
  postDropHold: 154,
} as const;

const PALETTE: Record<Exclude<CellColor, "theme">, string> = {
  cyan: "#4B607C",
  red: "#8F4632",
  green: "#A3A473",
  orange: "#D4904E",
  flash: "#fff5b4",
};

const BORDER: Partial<Record<PieceColor, string>> = {
  cyan: "#2D3D55",
  red: "#4F271C",
  green: "#5A5A3F",
  orange: "#754F2B",
};

const FACE_TOP = 0.08;
const FACE_BOTTOM = 0.06;
const EDGE = {
  widths: {
    outer: 2,
    inner: 1,
    seamOuter: 1,
    seamInner: 0.5,
  },
  alpha: {
    topOuter: 0.28,
    topInner: 0.14,
    sideOuter: 0.62,
    sideInner: 0.38,
    bottomOuter: 1,
    bottomInner: 0.78,
  },
  same: {
    topOuterScale: 0.45,
    topOuterMin: 0.12,
    topInner: 0.06,
    bottomOuter: 0.24,
    bottomInner: 0.12,
    sideOuter: 0.22,
    sideInner: 0.08,
  },
};

export function toCellKey(y: number, x: number): string {
  return `${y}:${x}`;
}

export function parseCellKey(position: string): { y: number; x: number } {
  const parts = position.split(":");
  return { y: Number(parts[0]), x: Number(parts[1]) };
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function cellKeys(cells: CellMap): string[] {
  return Object.keys(cells).sort();
}

export function copyCells(cells: CellMap): CellMap {
  return { ...cells };
}

export function mergePiece(cells: CellMap, piece: Piece, x: number, y: number): void {
  for (const [cellY, cellX] of piece.cells) {
    cells[toCellKey(y + cellY, x + cellX)] = piece.color;
  }
}

export function assembleSettled(): CellMap {
  const settled: CellMap = {};
  for (const step of LOGO_SEQUENCE) {
    mergePiece(settled, step.piece, step.piece.targetX, step.piece.targetY);
  }
  return settled;
}

export function cellsExceptRow(settled: CellMap, row: number, color: CellColor): CellMap {
  const next: CellMap = {};
  for (const position of Object.keys(settled)) {
    const point = parseCellKey(position);
    if (point.y === row) continue;
    next[position] = color;
  }
  return next;
}

export function dropAfterClear(settled: CellMap, color: CellColor): CellMap {
  const dropped: CellMap = {};
  for (const [position, cellColor] of Object.entries(cellsExceptRow(settled, CLEAR_ROW, color))) {
    const point = parseCellKey(position);
    dropped[toCellKey(point.y + 1, point.x)] = cellColor;
  }
  return dropped;
}

export function themeLogoCells(): CellMap {
  const cells: CellMap = {};
  for (const position of FINAL_LOGO) cells[position] = "theme";
  return cells;
}

export function pieceStartY(piece: Piece, extraTopRows: number): number {
  return extraTopRows > 0 ? -extraTopRows - 1 : piece.startY;
}

export function piecePosition(piece: Piece, t: number, extraTopRows = 0): { x: number; y: number } {
  const eased = easeOutCubic(Math.max(0, Math.min(1, t)));
  const startY = pieceStartY(piece, extraTopRows);
  return {
    x: Math.round(piece.startX + (piece.targetX - piece.startX) * eased),
    y: Math.round(startY + (piece.targetY - startY) * eased),
  };
}

export function composeCells(
  settled: CellMap,
  active?: { piece: Piece; x: number; y: number } | null,
  options?: { flashClearRow?: boolean; settledColor?: CellColor | null; themeLogo?: boolean },
): CellMap {
  if (options?.themeLogo) return themeLogoCells();

  const cells = copyCells(settled);
  if (active) mergePiece(cells, active.piece, active.x, active.y);

  if (options?.flashClearRow) {
    for (let x = 1; x <= 6; x += 1) cells[toCellKey(CLEAR_ROW, x)] = "flash";
  }

  if (options?.settledColor) {
    for (const position of Object.keys(cells)) {
      if (cells[position] !== "flash") cells[position] = options.settledColor;
    }
  }

  return cells;
}

function fillRect(
  ctx: CanvasRenderingContext2D,
  fill: string,
  alpha: number,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (alpha <= 0 || width <= 0 || height <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, width, height);
  ctx.globalAlpha = 1;
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  color: CellColor,
  themeColor: string,
  neighbors: Partial<Record<"top" | "right" | "bottom" | "left", CellColor | undefined>>,
) {
  const fillColor = color === "theme" ? themeColor : PALETTE[color];
  const borderColor = color === "flash" || color === "theme" ? undefined : BORDER[color];
  ctx.fillStyle = fillColor;
  ctx.fillRect(left, top, width, height);
  if (!borderColor) return;

  const innerLeft = left + 1;
  const innerTop = top + 1;
  const innerWidth = width - 2;
  const innerHeight = height - 2;
  const canInset = width > 4 && height > 4;
  const sameTop = neighbors.top === color;
  const sameRight = neighbors.right === color;
  const sameBottom = neighbors.bottom === color;
  const sameLeft = neighbors.left === color;

  if (innerWidth > 0 && innerHeight > 0) {
    const faceTopHeight = Math.max(1, Math.floor(innerHeight * 0.55));
    fillRect(ctx, "#ffffff", FACE_TOP, innerLeft, innerTop, innerWidth, faceTopHeight);
    fillRect(
      ctx,
      "#000000",
      FACE_BOTTOM,
      innerLeft,
      innerTop + faceTopHeight,
      innerWidth,
      innerHeight - faceTopHeight,
    );
  }

  const topOuter = sameTop ? EDGE.widths.seamOuter : EDGE.widths.outer;
  const topInner = sameTop ? EDGE.widths.seamInner : EDGE.widths.inner;
  const bottomOuter = sameBottom ? EDGE.widths.seamOuter : EDGE.widths.outer;
  const bottomInner = sameBottom ? EDGE.widths.seamInner : EDGE.widths.inner;
  const leftOuter = sameLeft ? EDGE.widths.seamOuter : EDGE.widths.outer;
  const rightOuter = sameRight ? EDGE.widths.seamOuter : EDGE.widths.outer;
  const leftInner = sameLeft ? EDGE.widths.seamInner : EDGE.widths.inner;
  const rightInner = sameRight ? EDGE.widths.seamInner : EDGE.widths.inner;
  const topOuterAlpha = sameTop
    ? Math.max(EDGE.same.topOuterMin, EDGE.alpha.topOuter * EDGE.same.topOuterScale)
    : EDGE.alpha.topOuter;

  fillRect(ctx, "#ffffff", topOuterAlpha, left, top, width, topOuter);
  fillRect(
    ctx,
    borderColor,
    sameBottom ? EDGE.same.bottomOuter : EDGE.alpha.bottomOuter,
    left,
    top + height - bottomOuter,
    width,
    bottomOuter,
  );
  fillRect(
    ctx,
    borderColor,
    sameLeft ? EDGE.same.sideOuter : EDGE.alpha.sideOuter,
    left,
    top,
    leftOuter,
    height,
  );
  fillRect(
    ctx,
    borderColor,
    sameRight ? EDGE.same.sideOuter : EDGE.alpha.sideOuter,
    left + width - rightOuter,
    top,
    rightOuter,
    height,
  );

  if (!canInset) return;

  fillRect(
    ctx,
    "#ffffff",
    sameTop ? EDGE.same.topInner : EDGE.alpha.topInner,
    innerLeft,
    top + topOuter,
    innerWidth,
    topInner,
  );
  fillRect(
    ctx,
    borderColor,
    sameBottom ? EDGE.same.bottomInner : EDGE.alpha.bottomInner,
    innerLeft,
    top + height - bottomOuter - bottomInner,
    innerWidth,
    bottomInner,
  );
  fillRect(
    ctx,
    sameLeft ? "#ffffff" : borderColor,
    sameLeft ? EDGE.same.sideInner : EDGE.alpha.sideInner,
    innerLeft,
    innerTop,
    leftInner,
    innerHeight,
  );
  fillRect(
    ctx,
    sameRight ? "#ffffff" : borderColor,
    sameRight ? EDGE.same.sideInner : EDGE.alpha.sideInner,
    left + width - rightOuter,
    innerTop,
    rightInner,
    innerHeight,
  );
}

export function paintCells(
  canvas: HTMLCanvasElement,
  cells: CellMap,
  options: { extraTopRows: number; themeColor: string },
): void {
  const extraTopRows = options.extraTopRows;
  const totalRows = BOARD_H + extraTopRows;
  const wrap = canvas.parentElement;
  if (!wrap) return;
  const wrapRect = wrap.getBoundingClientRect();
  if (wrapRect.width <= 0) return;

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = wrapRect.width;
  const cssHeight = (wrapRect.width / BOARD_W) * totalRows;
  const bitmapWidth = Math.max(1, Math.round(cssWidth * dpr));
  const bitmapHeight = Math.max(1, Math.round(cssHeight * dpr));
  if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
    canvas.width = bitmapWidth;
    canvas.height = bitmapHeight;
  }
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, bitmapWidth, bitmapHeight);

  const cellW = bitmapWidth / BOARD_W;
  const cellH = bitmapHeight / totalRows;
  const xLines = Array.from({ length: BOARD_W + 1 }, (_, x) => Math.round(x * cellW));
  const yLines = Array.from({ length: totalRows + 1 }, (_, y) => Math.round(y * cellH));
  const grid = (lines: number[], index: number, size: number) =>
    index >= 0 && index < lines.length ? lines[index]! : Math.round(index * size);

  const colorAt = (y: number, x: number) => cells[toCellKey(y, x)];
  for (const [position, color] of Object.entries(cells)) {
    const point = parseCellKey(position);
    const canvasY = point.y + extraTopRows;
    const left = grid(xLines, point.x, cellW);
    const top = grid(yLines, canvasY, cellH);
    const right = grid(xLines, point.x + 1, cellW);
    const bottom = grid(yLines, canvasY + 1, cellH);
    drawBlock(ctx, left, top, right - left, bottom - top, color, options.themeColor, {
      top: colorAt(point.y - 1, point.x),
      right: colorAt(point.y, point.x + 1),
      bottom: colorAt(point.y + 1, point.x),
      left: colorAt(point.y, point.x - 1),
    });
  }
}

export function extraTopRowsForWrap(wrap: HTMLElement): number {
  const wrapRect = wrap.getBoundingClientRect();
  if (wrapRect.width <= 0) return 0;
  const cellCss = wrapRect.width / BOARD_W;
  const totalRows = Math.max(BOARD_H, Math.ceil(wrapRect.bottom / cellCss));
  return totalRows - BOARD_H;
}

function sleep(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const timer = window.setTimeout(() => resolve(!signal.aborted), ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve(false);
      },
      { once: true },
    );
  });
}

export interface PiLogoPlayer {
  play(): Promise<boolean>;
  cancel(): void;
  showStatic(): void;
  resize(): void;
}

export function createPiLogoPlayer(options: {
  canvas: HTMLCanvasElement;
  wrap: HTMLElement;
  themeColor: () => string;
}): PiLogoPlayer {
  let abort: AbortController | undefined;
  let extraTopRows = 0;
  let tall = false;
  let cells: CellMap = {};

  function paint(next = cells) {
    cells = next;
    paintCells(options.canvas, cells, {
      extraTopRows,
      themeColor: options.themeColor(),
    });
  }

  function updateTallBounds() {
    extraTopRows = extraTopRowsForWrap(options.wrap);
  }

  function showStatic() {
    extraTopRows = 0;
    paint(themeLogoCells());
  }

  function resize() {
    if (tall) updateTallBounds();
    paint();
  }

  function cancel() {
    abort?.abort();
    abort = undefined;
    tall = false;
    showStatic();
  }

  async function hold(
    settled: CellMap,
    ms: number,
    signal: AbortSignal,
    composeOptions?: { flashClearRow?: boolean; settledColor?: CellColor | null },
  ): Promise<boolean> {
    const frames = Math.max(1, Math.round(ms / FRAME_MS));
    for (let i = 0; i < frames; i += 1) {
      if (signal.aborted) return false;
      paint(composeCells(settled, null, composeOptions));
      if (!(await sleep(FRAME_MS, signal))) return false;
    }
    return true;
  }

  async function animatePiece(
    settled: CellMap,
    piece: Piece,
    duration: number,
    signal: AbortSignal,
  ): Promise<boolean> {
    const startY = pieceStartY(piece, extraTopRows);
    const fallDistance = Math.abs(piece.targetY - startY);
    const scaledDuration = Math.min(392, duration + Math.max(0, fallDistance - 6) * 8);
    const frames = Math.max(Math.round(scaledDuration / FRAME_MS), 7);

    for (let i = 0; i < frames; i += 1) {
      if (signal.aborted) return false;
      const { x, y } = piecePosition(piece, (i + 1) / frames, extraTopRows);
      paint(composeCells(settled, { piece, x, y }));
      if (!(await sleep(FRAME_MS, signal))) return false;
    }

    mergePiece(settled, piece, piece.targetX, piece.targetY);
    paint(composeCells(settled));
    return sleep(35, signal);
  }

  async function play(): Promise<boolean> {
    abort?.abort();
    abort = new AbortController();
    const signal = abort.signal;
    tall = true;
    updateTallBounds();

    try {
      let settled: CellMap = {};
      if (!(await hold(settled, LOGO_TIMING.initialHold, signal))) return false;

      for (const step of LOGO_SEQUENCE) {
        if (!(await animatePiece(settled, step.piece, step.duration, signal))) return false;
        if (step.holdAfter > 0 && !(await hold(settled, step.holdAfter, signal))) return false;
      }

      for (let i = 0; i < LOGO_TIMING.clearFlashCount; i += 1) {
        const on = i % 2 === 0;
        if (
          !(await hold(settled, LOGO_TIMING.clearFlashStep, signal, {
            flashClearRow: on,
            settledColor: on ? "theme" : null,
          }))
        ) {
          return false;
        }
      }

      const floating = cellsExceptRow(settled, CLEAR_ROW, "theme");
      if (!(await hold(floating, LOGO_TIMING.postClearHold, signal))) return false;
      settled = dropAfterClear(settled, "theme");
      if (!(await hold(settled, LOGO_TIMING.postDropHold, signal))) return false;
      if (signal.aborted) return false;
      showStatic();
      return true;
    } finally {
      tall = false;
      if (abort?.signal === signal) abort = undefined;
    }
  }

  paint({});
  return { play, cancel, showStatic, resize };
}
