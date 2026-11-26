import { describe, expect, it } from "vitest"
import { viewShortcut } from "@features/panel-host/lib/view-shortcut.js"

const key = (code: string, mods: Partial<KeyboardEvent> = {}) =>
  ({
    code,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    defaultPrevented: false,
    ...mods,
  }) as KeyboardEvent

describe("视图快捷键", () => {
  it("Ctrl/⌘+数字直达，Ctrl+PageUp/PageDown 相邻翻页", () => {
    expect(viewShortcut(key("Digit2", { ctrlKey: true }), false)).toEqual({ to: 1 })
    expect(viewShortcut(key("Digit2", { metaKey: true }), true)).toEqual({ to: 1 })
    expect(viewShortcut(key("Digit2", { ctrlKey: true }), true)).toBeNull()
    expect(viewShortcut(key("PageDown", { ctrlKey: true }), false)).toEqual({ step: 1 })
    expect(viewShortcut(key("PageUp", { ctrlKey: true }), true)).toEqual({ step: -1 })
  })

  it("Ctrl+←/→ 相邻翻页，输入框里有字时让给按词移动光标", () => {
    expect(viewShortcut(key("ArrowRight", { ctrlKey: true }), false)).toEqual({ step: 1 })
    expect(viewShortcut(key("ArrowLeft", { ctrlKey: true }), true)).toEqual({ step: -1 })
    expect(viewShortcut(key("ArrowLeft", { ctrlKey: true }), false, true)).toBeNull()
    expect(viewShortcut(key("PageDown", { ctrlKey: true }), false, true)).toEqual({ step: 1 })
  })
})
