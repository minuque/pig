import { afterEach, describe, expect, it, vi } from "vitest"
import {
  activeToast,
  dismissToast,
  pauseToast,
  resetToasts,
  resumeToast,
  statusDuration,
  toastAction,
  toastAnnouncement,
  toastProgress,
  toastRemainingMs,
  toastStatus,
  triggerToastAction,
} from "../../src/ui/toast/index.js"

afterEach(() => {
  vi.useRealTimers()
  resetToasts()
})

describe("toast channel", () => {
  it("忽略空消息或纯空白消息", () => {
    expect(toastStatus("")).toBeUndefined()
    expect(toastStatus("   \n\t ")).toBeUndefined()
    expect(activeToast.value).toBeNull()
  })

  it("按文本长度在 3-5s 之间计算状态提示停留时长", () => {
    expect(statusDuration("已保存")).toBe(3_000)
    expect(statusDuration("a".repeat(200))).toBe(5_000)
    expect(statusDuration("custom", 4_200)).toBe(4_200)
  })

  it("单条替换且对未撤销的动作提示触发 onExpire", () => {
    const expired = vi.fn()

    toastAction("已归档「会话 A」", { label: "撤销", run: () => {} }, { onExpire: expired })
    expect(expired).not.toHaveBeenCalled()

    toastStatus("已复制", { tone: "accent" })
    expect(expired).toHaveBeenCalledTimes(1)
    expect(activeToast.value?.message).toBe("已复制")
    expect(activeToast.value?.kind).toBe("status")
    expect(activeToast.value?.sheen).toBe(true)
  })

  it("Action Toast 悬停暂停计时，移出后继续并触发 onExpire", () => {
    vi.useFakeTimers()
    const expired = vi.fn()

    toastAction(
      "已从队列移除",
      { label: "撤销", run: () => {} },
      { duration: 5_000, onExpire: expired },
    )
    expect(activeToast.value?.sheen).toBe(false)

    vi.advanceTimersByTime(2_000)
    pauseToast()
    const pausedAt = toastRemainingMs.value
    expect(pausedAt).toBe(3_000)

    vi.advanceTimersByTime(5_000)
    expect(activeToast.value).not.toBeNull()
    expect(expired).not.toHaveBeenCalled()

    resumeToast()
    vi.advanceTimersByTime(2_999)
    expect(activeToast.value).not.toBeNull()

    vi.advanceTimersByTime(1)
    expect(activeToast.value).toBeNull()
    expect(expired).toHaveBeenCalledTimes(1)
  })

  it("触发 Undo 后不执行 onExpire，并在原地蜕变为完成确认态", async () => {
    vi.useFakeTimers()
    const expired = vi.fn()
    const run = vi.fn()
    const initialSeq = activeToast.value?.seq ?? 0

    toastAction(
      "已归档「会话」",
      { label: "撤销", icon: "undo", revertedLabel: "已恢复", run },
      { onExpire: expired },
    )
    const beforeMorph = activeToast.value!
    expect(beforeMorph.seq).toBeGreaterThan(initialSeq)

    await triggerToastAction()

    expect(run).toHaveBeenCalledTimes(1)
    expect(expired).not.toHaveBeenCalled()
    expect(activeToast.value?.kind).toBe("status")
    expect(activeToast.value?.message).toBe("已恢复")
    expect(activeToast.value?.sheen).toBe(true)
    expect(activeToast.value?.seq).toBeGreaterThan(beforeMorph.seq)

    vi.advanceTimersByTime(1_500)
    expect(activeToast.value).toBeNull()
  })

  it("Progress Toast 运行时不自动过期，finish 后原地切换结果并打开扫光", async () => {
    vi.useFakeTimers()
    const handle = toastProgress("正在重新加载…")

    expect(activeToast.value?.kind).toBe("progress")
    expect(activeToast.value?.sheen).toBe(false)

    vi.advanceTimersByTime(60_000)
    expect(activeToast.value?.kind).toBe("progress")

    const beforeSeq = activeToast.value!.seq
    handle.update({ message: "仍在加载…" })
    expect(activeToast.value?.message).toBe("仍在加载…")

    handle.finish({ message: "已重新加载", tone: "success" })
    expect(activeToast.value?.kind).toBe("status")
    expect(activeToast.value?.message).toBe("已重新加载")
    expect(activeToast.value?.sheen).toBe(true)
    expect(activeToast.value?.seq).toBeGreaterThan(beforeSeq)

    await Promise.resolve()
    expect(toastAnnouncement.value).toBe("已重新加载")

    vi.advanceTimersByTime(3_000)
    expect(activeToast.value).toBeNull()

    dismissToast("missing")
  })
})
