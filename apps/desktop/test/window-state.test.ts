import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import {
  DEFAULT_WINDOW_SIZE,
  MIN_WINDOW_SIZE,
  parseWindowState,
  readWindowStateFile,
  restoreWindowFrame,
  windowStatePath,
  writeWindowStateFile,
} from "../src/main/window-state.js"

const DISPLAY = { x: 0, y: 0, width: 1920, height: 1080 }

describe("window state persistence", () => {
  let tempRoot: string | undefined

  afterEach(async () => {
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true })
    tempRoot = undefined
  })

  it("合法 bounds 写入后读回，并按显示器还原尺寸与最大化", async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "pig-window-state-"))
    const file = windowStatePath(tempRoot)
    const saved = { x: 80, y: 40, width: 1440, height: 900, isMaximized: true }
    writeWindowStateFile(file, saved)

    expect(JSON.parse(await readFile(file, "utf8"))).toEqual(saved)
    expect(readWindowStateFile(file)).toEqual(saved)
    expect(restoreWindowFrame(saved, [DISPLAY])).toEqual(saved)
  })

  it("失败路径：坏 JSON、缺字段、非有限数字丢弃", async () => {
    expect(parseWindowState(null)).toBeUndefined()
    expect(parseWindowState({ x: 0, y: 0, width: 800, height: 600 })).toBeUndefined()
    expect(
      parseWindowState({ x: 0, y: 0, width: Number.NaN, height: 600, isMaximized: false }),
    ).toBeUndefined()
    expect(
      parseWindowState({ x: 0, y: 0, width: 0, height: 600, isMaximized: false }),
    ).toBeUndefined()

    tempRoot = await mkdtemp(join(tmpdir(), "pig-window-state-"))
    const file = windowStatePath(tempRoot)
    await writeFile(file, "{not json", "utf8")
    expect(readWindowStateFile(file)).toBeUndefined()
    expect(readWindowStateFile(join(tempRoot, "missing.json"))).toBeUndefined()
  })

  it("失败路径：完全离开显示器退回默认尺寸", () => {
    const offScreen = { x: 8000, y: 6000, width: 1280, height: 800, isMaximized: true }

    expect(restoreWindowFrame(offScreen, [DISPLAY])).toEqual({
      ...DEFAULT_WINDOW_SIZE,
      isMaximized: false,
    })
    expect(restoreWindowFrame(undefined, [DISPLAY])).toEqual({
      ...DEFAULT_WINDOW_SIZE,
      isMaximized: false,
    })
  })

  it("过小尺寸钳到下限，仍保留在屏坐标", () => {
    const tiny = { x: 100, y: 80, width: 120, height: 80, isMaximized: false }

    expect(restoreWindowFrame(tiny, [DISPLAY])).toEqual({
      x: 100,
      y: 80,
      width: MIN_WINDOW_SIZE.width,
      height: MIN_WINDOW_SIZE.height,
      isMaximized: false,
    })
  })
})
