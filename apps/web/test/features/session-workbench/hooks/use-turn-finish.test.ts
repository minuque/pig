import { afterEach, describe, expect, it, vi } from "vitest"
import { nextTick, ref, shallowRef } from "vue"
import type { TranscriptItem } from "@/types/common-type.js"
import { useComposerQueue } from "@features/composer/hooks/use-composer-queue.js"
import { useTurnFinish } from "@features/session-workbench/hooks/use-turn-finish.js"

const stops: (() => void)[] = []

afterEach(() => {
  for (const stop of stops) stop()
  stops.length = 0
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

/** 接线成 index.vue 的形态：前台走 sendForeground，后台走 sendBackground。 */
function setup(options?: { backgroundAccepted?: boolean }) {
  const sessionId = ref<string | undefined>("s1")
  const running = ref(false)
  const items = shallowRef<readonly TranscriptItem[]>([])
  const queue = useComposerQueue()
  const sound = { play: vi.fn() }
  const sent: { id: string; text: string }[] = []
  let accepted = options?.backgroundAccepted ?? true
  const turnFinish = useTurnFinish({
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
    sendBackground: async (id, text) => {
      sent.push({ id, text })
      return accepted
    },
    transcriptFor: () => items.value,
  })

  stops.push(turnFinish.stop)
  return {
    running,
    items,
    queue,
    sound,
    sent,
    sessionId,
    turnFinish,
    reject: () => {
      accepted = false
    },
  }
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

describe("后台会话收尾", () => {
  it("队列有货直接发出返回 sent；队列空返回 done 并响完成音", async () => {
    const ctx = setup()

    ctx.items.value = [assistant("complete")]
    ctx.queue.setKey("s1")
    ctx.queue.enqueue("后台一条")
    ctx.queue.setKey("s2")

    await expect(ctx.turnFinish.onBackgroundIdle("s1")).resolves.toBe("sent")
    expect(ctx.sent).toEqual([{ id: "s1", text: "后台一条" }])
    expect(ctx.sound.play).not.toHaveBeenCalled()

    await expect(ctx.turnFinish.onBackgroundIdle("s1")).resolves.toBe("done")
    expect(ctx.sound.play).toHaveBeenCalledWith("done")
    expect(ctx.sound.play).toHaveBeenCalledTimes(1)
  })

  it("失败路径：后台发送失败条目回队首且不响完成音", async () => {
    const ctx = setup({ backgroundAccepted: false })

    ctx.items.value = [assistant("complete")]
    ctx.queue.setKey("s1")
    ctx.queue.enqueue("第一条")
    ctx.queue.enqueue("第二条")
    ctx.queue.setKey("s2")

    await expect(ctx.turnFinish.onBackgroundIdle("s1")).resolves.toBe("done")
    expect(ctx.queue.sizeFor("s1")).toBe(2)
    expect(ctx.sound.play).not.toHaveBeenCalled()
  })

  it("失败路径：最后一条助手 error 不响完成音", async () => {
    const ctx = setup()

    ctx.items.value = [assistant("error")]
    ctx.queue.setKey("s1")

    await expect(ctx.turnFinish.onBackgroundIdle("s1")).resolves.toBe("done")
    expect(ctx.sound.play).not.toHaveBeenCalled()
  })
})
