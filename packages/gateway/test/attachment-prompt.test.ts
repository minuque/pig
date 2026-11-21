import type { AgentSession } from "@earendil-works/pi-coding-agent"
import { describe, expect, it } from "vitest"

import type { AttachmentSink, StagedAttachment } from "../src/pi/attachments.js"
import { PiHostSession } from "../src/pi/session-runtime.js"

const stagedFile: StagedAttachment = {
  kind: "file",
  id: "f1",
  batch: "b1",
  name: "note.md",
  mimeType: "text/markdown",
  size: 2,
  path: "/tmp/pig-attachments/b1/f1-note.md",
}

function memorySink(items: readonly StagedAttachment[] = [stagedFile]) {
  const batches = new Map<string, StagedAttachment[]>(items.length ? [["b1", [...items]]] : [])
  const calls: string[] = []
  const sink: AttachmentSink = {
    take(batch) {
      const found = batches.get(batch)

      batches.delete(batch)
      calls.push(`take:${batch}`)
      return found
    },
    restore(batch, restored) {
      calls.push(`restore:${batch}`)
      batches.set(batch, [...restored, ...(batches.get(batch) ?? [])])
    },
  }
  return { sink, batches, calls }
}

function fakeSession(onPrompt: () => Promise<void> = async () => undefined) {
  const prompts: string[] = []
  const session = {
    sessionId: "s",
    isIdle: true,
    sessionManager: { getSessionFile: () => undefined, getEntries: () => [] },
    subscribe: () => () => undefined,
    async prompt(text: string) {
      prompts.push(text)
      await onPrompt()
    },
    async waitForIdle() {},
  } as unknown as AgentSession
  return { session, prompts }
}

describe("网关：prompt 按 batch 原子消费附件", () => {
  it("带 batch 时取走暂存，非图片路径进 <attached_files>", async () => {
    const { sink, batches } = memorySink()
    const { session, prompts } = fakeSession()
    const host = new PiHostSession(session, undefined, sink)

    await host.prompt({ text: "看这个", attachmentBatch: "b1" })

    expect(prompts[0]).toContain("<attached_files>")
    expect(prompts[0]).toContain(stagedFile.path)
    expect(batches.has("b1")).toBe(false)
  })

  it("不带 batch 时不碰暂存", async () => {
    const { sink, batches, calls } = memorySink()
    const { session, prompts } = fakeSession()
    const host = new PiHostSession(session, undefined, sink)

    await host.prompt({ text: "普通消息" })

    expect(calls).toEqual([])
    expect(batches.get("b1")).toHaveLength(1)
    expect(prompts[0]).toBe("普通消息")
  })

  it("prompt 失败按同一个 batch 放回，附件不静默丢失", async () => {
    const { sink, batches } = memorySink()
    const { session } = fakeSession(async () => {
      throw new Error("boom")
    })
    const host = new PiHostSession(session, undefined, sink)

    await expect(host.prompt({ text: "看这个", attachmentBatch: "b1" })).rejects.toThrow("boom")
    expect(batches.get("b1")).toEqual([stagedFile])
  })

  it("未知或已过期的 batch 直接拒绝，不发 prompt", async () => {
    const { sink, calls } = memorySink()
    const { session, prompts } = fakeSession()
    const host = new PiHostSession(session, undefined, sink)

    await expect(host.prompt({ text: "看这个", attachmentBatch: "gone" })).rejects.toMatchObject({
      code: "invalid_request",
    })
    expect(prompts).toEqual([])
    expect(calls).toEqual(["take:gone"])
  })
})
