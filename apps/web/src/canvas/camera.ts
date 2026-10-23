export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 4
export const AXIS_LIMIT = 50_000

export type Camera = {
  x: number
  y: number
  zoom: number
}

export type Point = {
  x: number
  y: number
}

export type Bounds = {
  x: number
  y: number
  width: number
  height: number
}

export type Size = {
  width: number
  height: number
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

export function clampZoom(zoom: number): number {
  if (!isFiniteNumber(zoom)) return 1
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

export function clampAxis(value: number): number {
  if (!isFiniteNumber(value)) return 0
  return Math.min(AXIS_LIMIT, Math.max(-AXIS_LIMIT, value))
}

export function cameraOrNull(value: unknown): Camera | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<Camera>

  if (!isFiniteNumber(raw.x) || !isFiniteNumber(raw.y) || !isFiniteNumber(raw.zoom)) return null
  return { x: clampAxis(raw.x), y: clampAxis(raw.y), zoom: clampZoom(raw.zoom) }
}

export function pointOrNull(value: unknown): Point | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<Point>

  if (!isFiniteNumber(raw.x) || !isFiniteNumber(raw.y)) return null
  return { x: clampAxis(raw.x), y: clampAxis(raw.y) }
}

/** 缩放后，锚点下的画布点仍落在同一视口坐标。 */
export function zoomAt(camera: Camera, nextZoom: number, anchor: Point): Camera {
  const zoom = clampZoom(nextZoom)
  const worldX = (anchor.x - camera.x) / camera.zoom
  const worldY = (anchor.y - camera.y) / camera.zoom
  return {
    x: clampAxis(anchor.x - worldX * zoom),
    y: clampAxis(anchor.y - worldY * zoom),
    zoom,
  }
}

export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return {
    x: clampAxis(camera.x + dx),
    y: clampAxis(camera.y + dy),
    zoom: camera.zoom,
  }
}

export function worldDelta(dx: number, dy: number, zoom: number): Point {
  const safe = zoom === 0 ? 1 : zoom
  return { x: dx / safe, y: dy / safe }
}

export function fitCamera(bounds: Bounds, viewport: Size, padding: number): Camera {
  const innerW = Math.max(1, viewport.width - padding * 2)
  const innerH = Math.max(1, viewport.height - padding * 2)
  const zoom = clampZoom(
    Math.min(innerW / Math.max(bounds.width, 1), innerH / Math.max(bounds.height, 1)),
  )
  const x = padding + (innerW - bounds.width * zoom) / 2 - bounds.x * zoom
  const y = padding + (innerH - bounds.height * zoom) / 2 - bounds.y * zoom
  return { x: clampAxis(x), y: clampAxis(y), zoom }
}

export function defaultCamera(): Camera {
  return { x: 0, y: 0, zoom: 1 }
}
