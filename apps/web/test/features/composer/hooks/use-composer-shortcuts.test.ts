import { describe, expect, it, vi } from "vitest"
import {
  createComposerShortcuts,
  shouldSubmitOnKeydown,
  type ComposerShortcutsOptions,
  type ShortcutKeyEvent,
} from "@features/composer/hooks/use-composer-shortcuts.js"

function keydown(key: string, overrides: Partial<ShortcutKeyEvent> = {}): ShortcutKeyEvent {
  return {
    key,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ctrlKey: false,
    defaultPrevented: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  }
}

function shortcuts(overrides: Partial<ComposerShortcutsOptions> = {}) {
  const calls = {
    closeMenu: vi.fn(),
    cancelQueueEdit: vi.fn(() => true),
    abort: vi.fn(() => true),
    blur: vi.fn(),
    focus: vi.fn(),
    pasteFiles: vi.fn(),
    historyPrev: vi.fn(),
    historyNext: vi.fn(),
  }
  const api = createComposerShortcuts({
    menuOpen: () => false,
    closeMenu: calls.closeMenu,
    cancelQueueEdit: calls.cancelQueueEdit,
    abort: calls.abort,
    hasText: () => false,
    blur: calls.blur,
    focus: calls.focus,
    pasteFiles: calls.pasteFiles,
    atStart: () => true,
    atEnd: () => true,
    historyPrev: calls.historyPrev,
    historyNext: calls.historyNext,
    ...overrides,
  })
  return { api, calls }
}

describe("Escape 优先级", () => {
  it("命令菜单打开时只关菜单", () => {
    const { api, calls } = shortcuts({ menuOpen: () => true })
    const event = keydown("Escape")

    expect(api.escape(event)).toBe(true)
    expect(calls.closeMenu).toHaveBeenCalledOnce()
    expect(calls.cancelQueueEdit).not.toHaveBeenCalled()
    expect(event.stopPropagation).toHaveBeenCalledOnce()
  })

  it("菜单关闭时先取消队列编辑，再中止回合", () => {
    const first = shortcuts()

    expect(first.api.escape(keydown("Escape"))).toBe(true)
    expect(first.calls.cancelQueueEdit).toHaveBeenCalledOnce()
    expect(first.calls.abort).not.toHaveBeenCalled()

    const next = shortcuts({ cancelQueueEdit: () => false })

    expect(next.api.escape(keydown("Escape"))).toBe(true)
    expect(next.calls.abort).toHaveBeenCalledOnce()
    expect(next.calls.blur).not.toHaveBeenCalled()
  })

  it("没有可取消的动作时，空输入框失焦、有文字不拦", () => {
    const empty = shortcuts({ cancelQueueEdit: () => false, abort: () => false })

    expect(empty.api.escape(keydown("Escape"))).toBe(true)
    expect(empty.calls.blur).toHaveBeenCalledOnce()

    const filled = shortcuts({
      cancelQueueEdit: () => false,
      abort: () => false,
      hasText: () => true,
    })

    expect(filled.api.escape(keydown("Escape"))).toBe(false)
    expect(filled.calls.blur).not.toHaveBeenCalled()
  })
})

describe("修饰键跟踪", () => {
  it("按住 Meta 或 Control 记为引导，松开即复位", () => {
    const { api } = shortcuts()

    api.trackModifiers(keydown("Enter", { metaKey: true }))
    expect(api.steerHeld.value).toBe(true)

    api.trackModifiers(keydown("Meta", { metaKey: false }))
    expect(api.steerHeld.value).toBe(false)

    api.trackModifiers(keydown("Enter", { ctrlKey: true }))
    expect(api.steerHeld.value).toBe(true)

    api.releaseModifiers()
    expect(api.steerHeld.value).toBe(false)
  })
})

describe("空输入框历史", () => {
  it("在开头向上取上一条，在末尾向下取下一条", () => {
    const { api, calls } = shortcuts()

    expect(api.navigateHistory(keydown("ArrowUp"))).toBe(true)
    expect(calls.historyPrev).toHaveBeenCalledOnce()

    expect(api.navigateHistory(keydown("ArrowDown"))).toBe(true)
    expect(calls.historyNext).toHaveBeenCalledOnce()
  })

  it("光标不在边缘时让方向键自己走", () => {
    const { api, calls } = shortcuts({ atStart: () => false, atEnd: () => false })

    expect(api.navigateHistory(keydown("ArrowUp"))).toBe(false)
    expect(api.navigateHistory(keydown("ArrowDown"))).toBe(false)
    expect(calls.historyPrev).not.toHaveBeenCalled()
    expect(calls.historyNext).not.toHaveBeenCalled()
  })

  it("带修饰键或输入法组合时不抢方向键", () => {
    const { api, calls } = shortcuts()

    expect(api.navigateHistory(keydown("ArrowUp", { shiftKey: true }))).toBe(false)
    expect(api.navigateHistory(keydown("ArrowUp", { ctrlKey: true }))).toBe(false)
    expect(api.navigateHistory(keydown("ArrowUp", { isComposing: true }))).toBe(false)
    expect(calls.historyPrev).not.toHaveBeenCalled()
  })
})

describe("shouldSubmitOnKeydown", () => {
  it("只认不带 Shift、不在组合中的 Enter", () => {
    expect(shouldSubmitOnKeydown({ key: "Enter", shiftKey: false, isComposing: false })).toBe(true)
    expect(shouldSubmitOnKeydown({ key: "Enter", shiftKey: true, isComposing: false })).toBe(false)
    expect(shouldSubmitOnKeydown({ key: "Enter", shiftKey: false, isComposing: true })).toBe(false)
    expect(shouldSubmitOnKeydown({ key: "a", shiftKey: false, isComposing: false })).toBe(false)
  })
})
