import { describe, expect, it, vi } from "vitest"
import type { TranscriptItem } from "@/types/common-type.js"

let server: TranscriptItem[] = []
let gatewayKnowsAfter = true
let appended = 0
const text = (id: string, role: "user" | "assistant", body: string) =>
  ({ id, role, content: [{ type: "text", text: body }], timestamp: 1 }) as TranscriptItem
/** 替身网关：照协议回 append 或全文；gatewayKnowsAfter 为假时像旧网关一样无视 after。 */
const transcript = vi.fn(async (_id: string, cursor?: { after?: string }) => {
  const timings = server
    .filter((item) => item.role === "user")
    .map((item) => ({ userId: item.id, startedAt: 1, outcome: "complete", endedAt: 2 }))
  const meta = { timings, hasMore: false, externalTurn: false }
  const [count, id] = cursor?.after?.split(":") ?? []
  const n = Number(count)

  if (gatewayKnowsAfter && n >= 1 && n <= server.length && server[n - 1]?.id === id) {
    appended += 1
    return { append: server.slice(n), ...meta }
  }

  return { items: [...server], ...meta }
})

vi.mock("@client/platform.js", () => ({ sessionTranscript: transcript }))

const { createHistoryStore } = await import("@features/session/hooks/use-session-history.js")

/** 一段会话的生命周期：首拉、live 覆盖后落盘、切分支、再追加；每步记下界面看到的转录与计时。 */
async function replay(knowsAfter: boolean) {
  gatewayKnowsAfter = knowsAfter
  const store = createHistoryStore()
  const seen: unknown[] = []
  const load = async () => {
    await store.loadHistory("s", { force: true })
    seen.push({ items: store.transcriptFor("s"), timings: store.timingsFor("s") })
  }

  server = [text("u1", "user", "一"), text("a1", "assistant", "答一")]
  await load()
  store.overlayLive("s", [text("m1", "user", "二"), text("m2", "assistant", "答二")])
  server = [...server, text("u2", "user", "二"), text("a2", "assistant", "答二")]
  await load()
  await load()
  server = [text("u1", "user", "一"), text("b1", "assistant", "另一支")]
  await load()
  server = [...server, text("b2", "user", "接着")]
  await load()
  return seen
}

describe("历史续拉：append 接上后与拿全文一致", () => {
  it("同一串变化下，带 after 的结果与旧网关回全文的结果逐步相同", async () => {
    const full = await replay(false)
    appended = 0
    const incremental = await replay(true)

    expect(appended).toBe(3)
    expect(incremental).toEqual(full)
  })
})
