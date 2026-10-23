import { describe, expect, it } from "vitest"
import { defaultCamera, fitCamera, panBy, worldDelta, zoomAt } from "@/canvas/camera.js"

describe("画布镜头", () => {
  it("缩放时锚点下的画布点不动", () => {
    const start = { x: 100, y: 50, zoom: 1 }
    const anchor = { x: 200, y: 80 }
    const before = {
      x: (anchor.x - start.x) / start.zoom,
      y: (anchor.y - start.y) / start.zoom,
    }

    for (const zoom of [2, 0.5, 1.25, 0.8]) {
      const next = zoomAt(start, zoom, anchor)
      expect((anchor.x - next.x) / next.zoom).toBeCloseTo(before.x)
      expect((anchor.y - next.y) / next.zoom).toBeCloseTo(before.y)
    }
  })

  it("按钮缩放以视口中心为锚点，两个方向都不漂", () => {
    const camera = { x: 20, y: -10, zoom: 1 }
    const center = { x: 400, y: 300 }
    const zoomed = zoomAt(camera, camera.zoom * 1.12, center)
    const back = zoomAt(zoomed, zoomed.zoom / 1.12, center)
    expect(back.x).toBeCloseTo(camera.x)
    expect(back.y).toBeCloseTo(camera.y)
    expect(back.zoom).toBeCloseTo(camera.zoom)
  })

  it("平移只改镜头，缩放不变", () => {
    expect(panBy({ x: 1, y: 2, zoom: 1.5 }, 10, -4)).toEqual({ x: 11, y: -2, zoom: 1.5 })
  })

  it("指针位移按当前缩放换成画布坐标", () => {
    expect(worldDelta(20, -10, 2)).toEqual({ x: 10, y: -5 })
  })

  it("适应全部包住边界并居中，不改条目坐标", () => {
    const bounds = { x: 24, y: 24, width: 200, height: 100 }
    const fitted = fitCamera(bounds, { width: 800, height: 600 }, 48)
    const left = fitted.x + bounds.x * fitted.zoom
    const top = fitted.y + bounds.y * fitted.zoom
    expect(left).toBeGreaterThanOrEqual(48)
    expect(top).toBeGreaterThanOrEqual(48)
    expect(fitted.zoom).toBeLessThanOrEqual(4)
    expect(fitted.zoom).toBeGreaterThanOrEqual(0.25)
  })

  it("重置镜头是默认值", () => {
    expect(defaultCamera()).toEqual({ x: 0, y: 0, zoom: 1 })
  })
})
