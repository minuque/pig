import { cameraOrNull, pointOrNull, type Camera, type Point } from "@/canvas/camera.js"

export const LAYOUT_KEY = "pig.canvas.ui"
export const LAYOUT_VERSION = 1
export const MAX_DOC_CHARS = 100_000
export const MAX_POSITIONS = 200
const PLACE_GAP = 28
const PLACE_ROW = 2400

export type ThemePref = {
  scheme: "light" | "dark"
  themeId: string
}

export type AppTheme = {
  scheme: "auto" | "light" | "dark"
  themeId: string | null
}

export type PlacedItem = {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export type ParsedLayout = {
  camera: Camera | null
  theme: ThemePref | null
  appTheme: AppTheme | null
  positions: Record<string, Point>
}

type LayoutContext = {
  ids: ReadonlySet<string>
  themeIds: ReadonlySet<string>
}

function themeOrNull(value: unknown, themeIds: ReadonlySet<string>): ThemePref | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<ThemePref>

  if (raw.scheme !== "light" && raw.scheme !== "dark") return null

  if (typeof raw.themeId !== "string" || !themeIds.has(raw.themeId)) return null
  return { scheme: raw.scheme, themeId: raw.themeId }
}

function appThemeOrNull(value: unknown, themeIds: ReadonlySet<string>): AppTheme | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<AppTheme>

  if (raw.scheme !== "auto" && raw.scheme !== "light" && raw.scheme !== "dark") return null

  if (raw.themeId !== null && (typeof raw.themeId !== "string" || !themeIds.has(raw.themeId)))
    return null
  return { scheme: raw.scheme, themeId: raw.themeId }
}

function positionsOf(value: unknown, ids: ReadonlySet<string>): Record<string, Point> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const positions: Record<string, Point> = {}

  for (const [id, raw] of Object.entries(value).slice(0, MAX_POSITIONS)) {
    if (!ids.has(id)) continue
    const point = pointOrNull(raw)

    if (point) positions[id] = point
  }

  return positions
}

/** 只保留当前条目的镜头、主题和位置。未知版本整份丢弃。 */
export function parseLayout(raw: string | null, context: LayoutContext): ParsedLayout | null {
  if (!raw || raw.length > MAX_DOC_CHARS) return null
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
  const doc = parsed as { version?: unknown }

  if (doc.version !== LAYOUT_VERSION && doc.version !== 0 && doc.version !== undefined) return null
  return {
    camera: cameraOrNull((parsed as { camera?: unknown }).camera),
    theme: themeOrNull((parsed as { theme?: unknown }).theme, context.themeIds),
    appTheme: appThemeOrNull((parsed as { appTheme?: unknown }).appTheme, context.themeIds),
    positions: positionsOf((parsed as { positions?: unknown }).positions, context.ids),
  }
}

export function serializeLayout(doc: {
  camera: Camera
  theme: ThemePref | null
  appTheme: AppTheme | null
  positions: Record<string, Point>
}): string {
  const positions: Record<string, Point> = {}

  for (const [id, point] of Object.entries(doc.positions).slice(0, MAX_POSITIONS)) {
    const next = pointOrNull(point)

    if (next) positions[id] = next
  }

  return JSON.stringify({
    version: LAYOUT_VERSION,
    camera: cameraOrNull(doc.camera),
    theme: doc.theme,
    appTheme: doc.appTheme,
    positions,
  })
}

function overlaps(a: PlacedItem, b: PlacedItem): boolean {
  return (
    a.x < b.x + b.width + PLACE_GAP &&
    a.x + a.width + PLACE_GAP > b.x &&
    a.y < b.y + b.height + PLACE_GAP &&
    a.y + a.height + PLACE_GAP > b.y
  )
}

function nudge(item: PlacedItem, occupied: PlacedItem[]): Point {
  let next = { ...item }

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (!occupied.some((other) => overlaps(next, other))) return { x: next.x, y: next.y }
    next = { ...next, x: next.x + item.width + PLACE_GAP }

    if (next.x > PLACE_ROW) next = { ...item, x: item.x, y: next.y + item.height + PLACE_GAP }
  }

  return { x: next.x, y: next.y }
}

/** 已保存的位置不动。新条目先用源码坐标，撞上已有块再挪到空位。 */
export function resolvePositions(
  items: readonly PlacedItem[],
  saved: Record<string, Point>,
): Record<string, Point> {
  const positions: Record<string, Point> = {}
  const occupied: PlacedItem[] = []

  for (const item of items) {
    const stored = saved[item.id]

    if (!stored) continue
    positions[item.id] = stored
    occupied.push({ ...item, ...stored })
  }

  for (const item of items) {
    if (positions[item.id]) continue
    const point = nudge(item, occupied)
    positions[item.id] = point
    occupied.push({ ...item, ...point })
  }

  return positions
}
