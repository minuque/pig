import { describe, expect, it, vi } from "vitest"

import { applyWindowMaterial } from "../src/main/window-material.js"

function fakeWindow() {
  return { setBackgroundMaterial: vi.fn(), setVibrancy: vi.fn() }
}

describe("applyWindowMaterial", () => {
  it("Windows 打开用 acrylic，关闭回 none", () => {
    const window = fakeWindow()

    applyWindowMaterial(window, "win32", true)
    expect(window.setBackgroundMaterial).toHaveBeenLastCalledWith("acrylic")
    expect(window.setVibrancy).not.toHaveBeenCalled()

    applyWindowMaterial(window, "win32", false)
    expect(window.setBackgroundMaterial).toHaveBeenLastCalledWith("none")
  })

  it("macOS 打开用 under-window，关闭传 null", () => {
    const window = fakeWindow()

    applyWindowMaterial(window, "darwin", true)
    expect(window.setVibrancy).toHaveBeenLastCalledWith("under-window")
    expect(window.setBackgroundMaterial).not.toHaveBeenCalled()

    applyWindowMaterial(window, "darwin", false)
    expect(window.setVibrancy).toHaveBeenLastCalledWith(null)
  })

  it("其他平台什么都不做", () => {
    const window = fakeWindow()

    applyWindowMaterial(window, "linux", true)
    expect(window.setBackgroundMaterial).not.toHaveBeenCalled()
    expect(window.setVibrancy).not.toHaveBeenCalled()
  })
})
