import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { AgentSession } from "@earendil-works/pi-coding-agent"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import { afterEach, describe, expect, it } from "vitest"
import { AttachmentStore } from "../src/pi/attachments.js"
import { PiHostService } from "../src/pi/service.js"
import { PiHostSession } from "../src/pi/session-runtime.js"

const PNG = { name: "截图.png", mimeType: "image/png" }
const PDF = { name: "报告 v2.pdf", mimeType: "application/pdf" }
const SESSION = "sess-1"
const stores: AttachmentStore[] = []
const roots: string[] = []

async function makeStore(): Promise<AttachmentStore> {
  const rootDir = await mkdtemp(join(tmpdir(), "pig-attach-prompt-"))

  roots.push(rootDir)
  const store = new AttachmentStore({ sweepIntervalMs: 0, rootDir })

  stores.push(store)
  return store
}

afterEach(async () => {
  await Promise.all(stores.map((store) => store.dispose()))
  stores.length = 0
  await Promise.all(roots.map((dir) => rm(dir, { recursive: true, force: true })))
  roots.length = 0
})

const stage = (
  store: AttachmentStore,
  batch: string,
  file: { name: string; mimeType: string },
  bytes: Uint8Array,
) => store.stage({ batch, ...file, stream: one(bytes) })

async function* one(bytes: Uint8Array): AsyncIterable<Uint8Array> {
  yield bytes
}

class FakeSession {
  isStreaming = false
  isCompacting = false
  retryAttempt = 0
  sessionId = SESSION
  model = { provider: "test", id: "test-model" }
  thinkingLevel = "medium"
  prompts: { text: string; options?: unknown }[] = []
  failNext = false

  constructor(public sessionManager: SessionManager) {}

  get isIdle() {
    return !this.isStreaming
  }

  subscribe() {
    return () => undefined
  }

  async prompt(text: string, options?: unknown) {
    this.prompts.push(options === undefined ? { text } : { text, options })

    if (this.failNext) throw new Error("provider exploded")
  }

  async waitForIdle() {}

  getSteeringMessages() {
    return []
  }

  dispose() {}
}

const asAgentSession = (fake: FakeSession) => fake as unknown as AgentSession

describe("PiHostSession 附件消费", () => {
  it("prompt 合并 pending 附件：图片走 images，文件走文本块", async () => {
    const store = await makeStore()
    await stage(store, "b1", PNG, Buffer.from("png"))
    await stage(store, "b2", PDF, Buffer.from("pdf"))
    store.bind(SESSION, "b1")
    store.bind(SESSION, "b2")
    const fake = new FakeSession(SessionManager.inMemory("/tmp"))
    const runtime = new PiHostSession(asAgentSession(fake), undefined, store)
    await runtime.prompt({ text: "看附件" })
    const call = fake.prompts[0]!

    expect(call.options).toMatchObject({ images: [{ type: "image", mimeType: "image/png" }] })
    expect(call.text).toContain(
      "看附件\n\n<attached_files>\n- 报告 v2.pdf — application/pdf — 3 — ",
    )
    // 消费后 pending 清空，下一次 prompt 不再重复带附件
    await runtime.prompt({ text: "再来" })
    expect(fake.prompts[1]).toEqual({ text: "再来" })
  })

  it("白名单外的 svg 走文本块，不进 images", async () => {
    const store = await makeStore()
    await stage(store, "b-svg", { name: "矢量图.svg", mimeType: "image/svg+xml" }, Buffer.from("x"))
    store.bind(SESSION, "b-svg")
    const fake = new FakeSession(SessionManager.inMemory("/tmp"))
    const runtime = new PiHostSession(asAgentSession(fake), undefined, store)
    await runtime.prompt({ text: "看图" })
    const call = fake.prompts[0]!

    expect(call.options).toBeUndefined()
    expect(call.text).toContain("- 矢量图.svg — image/svg+xml — 1 — ")
  })

  it("无附件时保持原来的调用形状", async () => {
    const fake = new FakeSession(SessionManager.inMemory("/tmp"))
    const runtime = new PiHostSession(asAgentSession(fake), undefined, await makeStore())
    await runtime.prompt({ text: "普通提问" })
    expect(fake.prompts).toEqual([{ text: "普通提问" }])
  })

  it("prompt 抛错时附件放回 pending，不静默丢失", async () => {
    const store = await makeStore()
    await stage(store, "b1", PNG, Buffer.from("png"))
    store.bind(SESSION, "b1")
    const fake = new FakeSession(SessionManager.inMemory("/tmp"))
    fake.failNext = true
    const runtime = new PiHostSession(asAgentSession(fake), undefined, store)
    await expect(runtime.prompt({ text: "看附件" })).rejects.toThrow("provider exploded")
    fake.failNext = false
    await runtime.prompt({ text: "重试" })
    expect(fake.prompts[1]?.options).toMatchObject({ images: [{ type: "image" }] })
  })
})

describe("PiHostService 附件通道", () => {
  it("暂存进 service.attachments，会话 prompt 读到同一份，删会话清 pending", async () => {
    const root = await mkdtemp(join(tmpdir(), "pig-attach-service-"))
    roots.push(root)
    const created: FakeSession[] = []
    const service = new PiHostService({
      sessionDir: root,
      cwd: root,
      attachmentRootDir: join(root, "attachments"),
      createRuntime: async () =>
        ({
          getModel: () => undefined,
          getAvailable: async () => [],
          hasConfiguredAuth: () => false,
        }) as never,
      createSession: (async (options: { sessionManager: SessionManager }) => {
        const fake = new FakeSession(options.sessionManager)
        fake.sessionId = options.sessionManager.getSessionId()
        created.push(fake)
        return { session: fake as unknown as AgentSession }
      }) as never,
    })

    stores.push(service.attachments)

    const runtime = await service.createSession({ id: SESSION })

    expect(await service.hasSession(SESSION)).toBe(true)
    expect(await service.hasSession("missing")).toBe(false)
    await stage(service.attachments, "svc-b1", PDF, Buffer.from("pdf"))
    service.attachments.bind(SESSION, "svc-b1")
    await runtime.prompt({ text: "看附件" })
    expect(created[0]?.prompts[0]?.text).toContain("<attached_files>\n- 报告 v2.pdf")

    // 删除会话走同一条清理路径：未消费的 pending 一并丢掉
    await stage(service.attachments, "svc-b2", PDF, Buffer.from("pdf"))
    service.attachments.bind(SESSION, "svc-b2")
    await service.deleteSession(SESSION)
    expect(service.attachments.take(SESSION)).toEqual([])
    await runtime.dispose()
    await service.dispose()
  })
})
