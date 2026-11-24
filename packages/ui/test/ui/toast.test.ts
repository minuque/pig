import { afterEach, describe, expect, it, vi } from "vitest"
import {
  PASSING_MS,
  noticeOf,
  noticeToaster,
  notify,
  notifyAction,
} from "../../src/ui/toast/index.js"

afterEach(() => {
  noticeToaster.dismiss()
})

describe("toast notify", () => {
  it("忽略空消息或纯空白消息", () => {
    notify("")
    notify("   \n\t ")

    expect(noticeToaster.toasts()).toHaveLength(0)
  })

  it("默认按常驻错误通知入队", () => {
    notify("  保存失败  ")

    const [item] = noticeToaster.toasts()
    expect(item).toBeDefined()
    expect(item!.type).toBe("error")
    expect(item!.duration).toBe(Number.POSITIVE_INFINITY)
    expect(item!.title).toBe("保存失败")
    expect(noticeOf(item!)).toEqual({
      message: "保存失败",
      level: "error",
      title: undefined,
      action: undefined,
    })
  })

  it("非错误级别与 transient 错误使用 PASSING_MS 自动消失", () => {
    notify("可重试错误", "error", { transient: true })
    notify("已更新", "info")

    const toasts = noticeToaster.toasts()
    expect(toasts).toHaveLength(2)
    expect(toasts[0]!.type).toBe("info")
    expect(toasts[0]!.duration).toBe(PASSING_MS)
    expect(toasts[1]!.type).toBe("error")
    expect(toasts[1]!.duration).toBe(PASSING_MS)
  })

  it("传入 title 与 action 时写入描述并绑定回调", () => {
    const run = vi.fn()
    notify("详情正文", "success", {
      title: "操作完成",
      action: { label: "撤销", icon: "undo", run },
    })

    const [item] = noticeToaster.toasts()
    expect(item!.title).toBe("操作完成")
    expect(item!.description).toBe("详情正文")
    expect(noticeOf(item!).action?.icon).toBe("undo")

    item!.action?.onAction?.(undefined, { source: "mouse" })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it("notifyAction 统一走常驻 error 通知", () => {
    notifyAction("停止失败")

    const [item] = noticeToaster.toasts()
    expect(noticeOf(item!).message).toBe("停止失败")
  })
})
