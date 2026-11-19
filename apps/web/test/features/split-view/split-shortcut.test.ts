import { describe, expect, it } from "vitest"
import { splitShortcut } from "@features/split-view/lib/split-shortcut.js"

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

describe("分屏快捷键", () => {
  it("macOS：⌃⌘\\ 右侧新建，⌃⌘W 关闭", () => {
    expect(splitShortcut(key("Backslash", { ctrlKey: true, metaKey: true }), true)).toBe(
      "new-right",
    )
    expect(splitShortcut(key("KeyW", { ctrlKey: true, metaKey: true }), true)).toBe("close")
  })

  it("其他平台用 Ctrl+Alt，Ctrl+Win 不响应", () => {
    expect(splitShortcut(key("Backslash", { ctrlKey: true, altKey: true }), false)).toBe(
      "new-right",
    )
    expect(splitShortcut(key("KeyW", { ctrlKey: true, altKey: true }), false)).toBe("close")
    expect(splitShortcut(key("Backslash", { ctrlKey: true, metaKey: true }), false)).toBeNull()
  })

  it("Ctrl+[ / Ctrl+] 两个平台都切焦点", () => {
    expect(splitShortcut(key("BracketRight", { ctrlKey: true }), true)).toBe("focus-next")
    expect(splitShortcut(key("BracketLeft", { ctrlKey: true }), false)).toBe("focus-previous")
  })

  it("带 Shift、长按重复或已被处理的按键不算", () => {
    expect(splitShortcut(key("BracketRight", { ctrlKey: true, shiftKey: true }), true)).toBeNull()
    expect(splitShortcut(key("BracketRight", { ctrlKey: true, repeat: true }), true)).toBeNull()
    expect(
      splitShortcut(key("BracketRight", { ctrlKey: true, defaultPrevented: true }), true),
    ).toBeNull()
  })
})
