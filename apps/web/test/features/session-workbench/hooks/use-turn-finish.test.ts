import { afterEach, describe, expect, it, vi } from "vitest"
import { effectScope, nextTick, ref, shallowRef, type EffectScope } from "vue"
import type { TranscriptItem } from "@/types/common-type.js"
import { useComposerQueue } from "@features/composer/hooks/use-composer-queue.js"

const notify = vi.fn()

vi.mock("@pig/ui/toast", () => ({ notify }))

const { useTurnFinish } = await import("@features/session-workbench/hooks/use-turn-finish.js")
const scopes: EffectScope[] = []

afterEach(() => {
  notify.mockClear()

  for (const scope of scopes) scope.stop()
  scopes.length = 0
})

function assistant(status: "complete" | "error" | "aborted"): TranscriptItem {
  const base = {
    id: `a-${status}`,
    role: "assistant" as const,
    content: [{ type: "text" as const, text: "答" }],
    model: { provider: "test", id: "model" },
    timestamp: 1,
  }

  if (status === "complete") return { ...base, status, stopReason: "stop" }

  if (status === "error") return { ...base, status, stopReason: "error" }
  return { ...base, status: "aborted", stopReason: "aborted" }
}

function setup() {
  const sessionId = ref<string | undefined>("s1")
  const running = ref(false)
  const items = shallowRef<readonly TranscriptItem[]>([])
  const queue = useComposerQueue()
  const sound = { play: vi.fn() }
  const sent: { id: string; text: string }[] = []
  const scope = effectScope()
  const turnFinish = scope.run(() =>
    useTurnFinish({
      sessionId: () => sessionId.value,
      running: () => running.value,
      pending: () => false,
      transcript: () => items.value,
      queue,
      sound,
      sendForeground: async (text) => {
        sent.push({ id: "", text })
        return true
      },
    }),
  )!

  scopes.push(scope)
  return { running, items, queue, sound, sent, sessionId, turnFinish }
}

describe("前台轮次收尾", () => {
  it("队列空且最后一条助手正常：响完成音", async () => {
    const ctx = setup()

    ctx.items.value = [assistant("complete")]
    ctx.running.value = true
    await nextTick()
    ctx.running.value = false
    await nextTick()

    expect(ctx.sound.play).toHaveBeenCalledWith("done")
  })

  it("队列有货：不响完成音，泵出队首", async () => {
    const ctx = setup()

    ctx.queue.setKey("s1")
    ctx.queue.enqueue("下一条")
    ctx.running.value = true
    await nextTick()
    ctx.running.value = false
    await nextTick()

    expect(ctx.sound.play).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(ctx.sent).toEqual([{ id: "", text: "下一条" }]))
    expect(ctx.queue.items.value).toEqual([])
  })

  it("失败路径：Abort 过的轮次不响完成音", async () => {
    const ctx = setup()

    ctx.items.value = [assistant("complete")]
    ctx.running.value = true
    await nextTick()
    ctx.turnFinish.markAborted()
    ctx.running.value = false
    await nextTick()

    expect(ctx.sound.play).not.toHaveBeenCalled()
  })

  it("失败路径：最后一条助手是 error 不响完成音", async () => {
    const ctx = setup()

    ctx.items.value = [assistant("error")]
    ctx.running.value = true
    await nextTick()
    ctx.running.value = false
    await nextTick()

    expect(ctx.sound.play).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.any(String), "error", { transient: true })
  })

  it("用户中止的轮次不弹出错通知", async () => {
    const ctx = setup()

    ctx.items.value = [assistant("error")]
    ctx.running.value = true
    await nextTick()
    ctx.turnFinish.markAborted()
    ctx.running.value = false
    await nextTick()

    expect(notify).not.toHaveBeenCalled()
  })

  it("失败路径：切会话时 running 的下降沿属于旧会话", async () => {
    const ctx = setup()

    ctx.items.value = [assistant("complete")]
    ctx.running.value = true
    await nextTick()
    ctx.sessionId.value = "s2"
    ctx.running.value = false
    await nextTick()

    expect(ctx.sound.play).not.toHaveBeenCalled()
  })
})
