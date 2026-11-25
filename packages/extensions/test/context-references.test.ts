import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import { formatContextReference, projectContextForAgent, sessionReference } from "@pig/protocol"
import { afterAll, describe, expect, it } from "vitest"
import {
  createReadSessionTool,
  locateSession,
  readSessionText,
} from "../src/context-references/read-session.ts"

type AppendMessage = Parameters<SessionManager["appendMessage"]>[0]

const root = await mkdtemp(join(tmpdir(), "pig-read-session-"))

process.env.PI_CODING_AGENT_DIR = root

const sessions = join(root, "sessions")
const usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
}

function assistant(
  content: Extract<AppendMessage, { role: "assistant" }>["content"],
): AppendMessage {
  return {
    role: "assistant",
    content,
    provider: "test",
    model: "test",
    api: "openai-completions",
    usage,
    stopReason: "stop",
    timestamp: Date.now(),
  }
}

function seed(turns: number) {
  const manager = SessionManager.create(root, sessions)
  const ref = formatContextReference(sessionReference("other", "别的会话"))
  manager.appendMessage({
    role: "user",
    content: projectContextForAgent(`第 0 问 ${ref}`),
    timestamp: Date.now(),
  })
  manager.appendMessage(
    assistant([
      { type: "thinking", thinking: "内部思考" },
      { type: "text", text: "先读文件" },
      { type: "toolCall", id: "call-1", name: "read", arguments: { path: "a.ts" } },
    ]),
  )
  manager.appendMessage({
    role: "toolResult",
    toolCallId: "call-1",
    toolName: "read",
    content: [{ type: "text", text: "x".repeat(4_000) }],
    isError: false,
    timestamp: Date.now(),
  })

  for (let turn = 1; turn < turns; turn += 1) {
    manager.appendMessage({ role: "user", content: `第 ${turn} 问`, timestamp: Date.now() })
    manager.appendMessage(assistant([{ type: "text", text: `第 ${turn} 答` }]))
  }

  return manager
}

afterAll(() => rm(root, { recursive: true, force: true }))

describe("read_session", () => {
  it("分页读文本 transcript：正文、工具摘要，不含思考与信封，给出 nextOffset", () => {
    const manager = seed(20)
    const first = readSessionText(manager, { sessionId: manager.getSessionId(), limit: 5 })

    expect(first).toContain("Entries 1-5 of 41. nextOffset=5")
    expect(first).toContain("第 0 问 [Session: 别的会话]")
    expect(first).not.toContain("<pig_context")
    expect(first).toContain('→ read({"path":"a.ts"})')
    expect(first).toContain("← read")
    expect(first).not.toContain("内部思考")
    expect(first).toMatch(/more chars; call read_session with entryId="[^"]+" for the full entry/)

    const last = readSessionText(manager, { sessionId: manager.getSessionId(), offset: 40 })
    expect(last).toContain("Entries 41-41 of 41. End of session.")
    expect(last).toContain("第 19 答")
  })

  it("按条目 id 读全文", () => {
    const manager = seed(1)
    const tool = manager
      .getBranch()
      .find((entry) => entry.type === "message" && entry.message.role === "toolResult")!
    const full = readSessionText(manager, { sessionId: manager.getSessionId(), entryId: tool.id })

    expect(full).toContain("x".repeat(4_000))
    expect(() =>
      readSessionText(manager, { sessionId: manager.getSessionId(), entryId: "missing" }),
    ).toThrow(/Entry "missing" is not in session/)
  })

  it("按 id 从本机会话目录找到文件并读回", async () => {
    const manager = seed(2)
    const path = await locateSession(manager.getSessionId(), sessions)

    expect(path).toBe(manager.getSessionFile())
    const text = readSessionText(SessionManager.open(path!), { sessionId: manager.getSessionId() })
    expect(text).toContain(`workspace: ${root}`)
    expect(text).toContain("第 1 答")
  })

  it("找不到的会话返回明确错误", async () => {
    const tool = createReadSessionTool()
    const ctx = { sessionManager: { getSessionDir: () => sessions } } as never

    await expect(
      tool.execute("call", { sessionId: "nope" }, undefined, undefined, ctx),
    ).rejects.toThrow(/Session "nope" was not found in this machine's session store/)
  })
})
