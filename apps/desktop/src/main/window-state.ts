import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export const DEFAULT_WINDOW_SIZE = { width: 1280, height: 800 } as const
export const MIN_WINDOW_SIZE = { width: 400, height: 300 } as const
export const WINDOW_STATE_FILE = "window-state.json"

export type WindowBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type WindowState = WindowBounds & {
  isMaximized: boolean
}

/** 交给 BrowserWindow 的初始框；缺 x/y 时由 Electron 居中。 */
export type WindowFrame = {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
}

export function windowStatePath(userData: string): string {
  return join(userData, WINDOW_STATE_FILE)
}

export function parseWindowState(raw: unknown): WindowState | undefined {
  if (typeof raw !== "object" || raw === null) return undefined

  if (!("x" in raw) || !("y" in raw) || !("width" in raw) || !("height" in raw)) return undefined

  if (!("isMaximized" in raw)) return undefined

  const x = finiteNumber(raw.x)
  const y = finiteNumber(raw.y)
  const width = finiteNumber(raw.width)
  const height = finiteNumber(raw.height)

  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return undefined
  }

  if (typeof raw.isMaximized !== "boolean") return undefined

  if (width <= 0 || height <= 0) return undefined
  return { x, y, width, height, isMaximized: raw.isMaximized }
}

export function readWindowStateFile(file: string): WindowState | undefined {
  try {
    return parseWindowState(JSON.parse(readFileSync(file, "utf8")))
  } catch {
    return undefined
  }
}

export function writeWindowStateFile(file: string, state: WindowState): void {
  try {
    writeFileSync(file, `${JSON.stringify(state)}\n`, "utf8")
  } catch {
    // 写失败不挡关窗
  }
}

export function restoreWindowFrame(
  state: WindowState | undefined,
  displays: readonly WindowBounds[],
): WindowFrame {
  if (!state || !isOnAnyDisplay(state, displays)) {
    return { ...DEFAULT_WINDOW_SIZE, isMaximized: false }
  }

  return {
    x: state.x,
    y: state.y,
    width: Math.max(MIN_WINDOW_SIZE.width, Math.round(state.width)),
    height: Math.max(MIN_WINDOW_SIZE.height, Math.round(state.height)),
    isMaximized: state.isMaximized,
  }
}

export function captureWindowState(window: {
  getNormalBounds(): WindowBounds
  isMaximized(): boolean
}): WindowState {
  const bounds = window.getNormalBounds()
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: window.isMaximized(),
  }
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function isOnAnyDisplay(bounds: WindowBounds, displays: readonly WindowBounds[]): boolean {
  return displays.some((display) => overlapArea(bounds, display) > 0)
}

function overlapArea(a: WindowBounds, b: WindowBounds): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return width * height
}
