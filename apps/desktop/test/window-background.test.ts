import { describe, expect, it, vi } from "vitest"

import { createWindowBackground } from "../src/main/window-background.js"

function setup() {
  const window = { setBackgroundColor: vi.fn() }
  return { window, background: createWindowBackground(() => window) }
}

describe("createWindowBackground", () => {
  it("未开材质时主题色直接写到底色", () => {
    const { window, background } = setup()

    background.setThemeColor("#123456")

    expect(window.setBackgroundColor).toHaveBeenLastCalledWith("#123456")
  })

  it("材质开着时写主题色会顶掉材质，所以只记住不写", () => {
    const { window, background } = setup()

    background.setTranslucent(true)
    background.setThemeColor("#123456")

    expect(window.setBackgroundColor).not.toHaveBeenCalled()
  })

  it("关掉材质后补回记住的主题色", () => {
    const { window, background } = setup()

    background.setThemeColor("#123456")
    background.setTranslucent(true)
    background.setThemeColor("#654321")
    background.setTranslucent(false)

    expect(window.setBackgroundColor).toHaveBeenLastCalledWith("#654321")
  })

  it("没收到过主题色时关材质不写底色", () => {
    const { window, background } = setup()

    background.setTranslucent(true)
    background.setTranslucent(false)

    expect(window.setBackgroundColor).not.toHaveBeenCalled()
  })
})
