import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import type { TranscriptItem } from "@pig/protocol"
import { afterEach, describe, expect, it } from "vitest"
import { TranscriptReader } from "../src/pi/transcript-reader.js"

const user = (id: string, text: string): TranscriptItem => ({
  id,
  role: "user",
  content: [{ type: "text", text }],
  timestamp: 1,
})
let root: string | undefined

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true, maxRetries: 5 })
  root = undefined
})

describe("历史接口：after 对得上只回尾巴", () => {
  const items = [user("u1", "一"), user("u2", "二"), user("u3", "三")]
  const reader = new TranscriptReader({
    live: () => ({ historyTranscript: () => ({ items, timings: [] }) }),
    findPath: async () => undefined,
  })

  it("活会话：第 n 条 id 对上回第 n 条之后的条目", async () => {
    expect(await reader.page("s", { after: "2:u2" })).toMatchObject({ append: [items[2]] })
    expect(await reader.page("s", { after: "3:u3" })).toMatchObject({ append: [] })
  })

  it("前缀对不上或不带 after：回全文", async () => {
    for (const after of [undefined, "2:u1", "4:u3", "0:", "x:u1", "u1"]) {
      const page = await reader.page("s", { after })
      expect(page, String(after)).toMatchObject({ items })
      expect(page).not.toHaveProperty("append")
    }
  })

  it("磁盘会话：known 没变回 unchanged，文件变了回尾巴与新版本", async () => {
    root = await mkdtemp(join(tmpdir(), "pig-reader-"))
    const manager = SessionManager.create(join(root, "work"), join(root, "sessions"), { id: "d" })
    manager.appendModelChange("test", "test-model")
    manager.appendMessage({ role: "user", content: "一", timestamp: 1 })
    const path = manager.getSessionFile() as string
    const disk = new TranscriptReader({ live: () => undefined, findPath: async () => path })
    const first = await disk.page("d")

    if (!("items" in first)) throw new Error("expected a full page")
    const after = `${first.items.length}:${first.items.at(-1)?.id}`
    expect(await disk.page("d", { known: first.version, after })).toEqual({ unchanged: true })

    SessionManager.open(path).appendMessage({ role: "user", content: "二", timestamp: 2 })
    const next = await disk.page("d", { known: first.version, after })

    if (!("append" in next)) throw new Error("expected an append page")
    expect(next.append).toMatchObject([{ role: "user", content: [{ type: "text", text: "二" }] }])
    expect(next.append).toHaveLength(1)
    expect(next.version).not.toBe(first.version)
  })
})
