import { describe, expect, it, vi } from "vitest"

import { installExternalLinks } from "../src/main/external-links.js"

type NavigateEvent = { preventDefault(): void }

type OpenDetails = { url: string }

type OpenResult = { action: "deny" }

function setup(currentUrl = "http://127.0.0.1:5173/") {
  let openHandler: ((details: OpenDetails) => OpenResult) | undefined
  let navigateHandler: ((event: NavigateEvent, url: string) => void) | undefined
  const contents = {
    setWindowOpenHandler(handler: (details: OpenDetails) => OpenResult) {
      openHandler = handler
    },
    on(event: string, handler: (event: NavigateEvent, url: string) => void) {
      if (event === "will-navigate") navigateHandler = handler
    },
    getURL: () => currentUrl,
  }
  const openExternal = vi.fn()
  installExternalLinks(contents, openExternal)
  return {
    open: (url: string) => openHandler?.({ url }),
    navigate: (url: string) => {
      const event = {
        prevented: false,
        preventDefault() {
          this.prevented = true
        },
      }

      navigateHandler?.(event, url)
      return event
    },
    openExternal,
  }
}

describe("installExternalLinks", () => {
  it("window.open 打开 http(s) 时交给系统浏览器并拒绝新窗口", () => {
    const { open, openExternal } = setup()

    expect(open("https://example.com/auth")).toEqual({ action: "deny" })
    expect(openExternal).toHaveBeenCalledWith("https://example.com/auth")
  })

  it("window.open 打开 file: 与 javascript: 时不交给系统浏览器", () => {
    const { open, openExternal } = setup()

    open("file:///etc/passwd")
    open("javascript:alert(1)")

    expect(openExternal).not.toHaveBeenCalled()
  })

  it("当前窗口导航到外部 http(s) 时阻止并交给系统浏览器", () => {
    const { navigate, openExternal } = setup()
    const event = navigate("https://example.com/auth")

    expect(event.prevented).toBe(true)
    expect(openExternal).toHaveBeenCalledWith("https://example.com/auth")
  })

  it("当前窗口内部导航不阻止", () => {
    const { navigate, openExternal } = setup()
    const event = navigate("http://127.0.0.1:5173/settings")

    expect(event.prevented).toBe(false)
    expect(openExternal).not.toHaveBeenCalled()
  })
})
