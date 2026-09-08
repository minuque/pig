import { SessionManager } from "@earendil-works/pi-coding-agent"
import { writeFileSync } from "node:fs"

export const SHORT_SESSION_ID = "bench-short"
export const LONG_SESSION_ID = "bench-long"
export const SHORT_SESSION_NAME = "短会话"
export const LONG_SESSION_NAME = "长会话"
export const EMPTY_SESSION_NAME = "空会话"
export const STRESS_SESSION_NAME = "混合大会话"

export const SHORT_TURNS = 2
export const LONG_TURNS = 40
export const STRESS_TURNS = 200

type AppendMessage = Parameters<SessionManager["appendMessage"]>[0]

const LONG_REPLY = "把 Snapshot 投到时间线，把 Composer 留在底栏。".repeat(3)

function assistantMessage(
  text: string,
  timestamp: number,
): Extract<AppendMessage, { role: "assistant" }> {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "openai-completions",
    provider: "test-provider",
    model: "test-model",
    usage: {
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 2,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp,
  }
}

/** 在 sessionDir 写入短/长会话，供打开、切换、滚动测量。 */
export function seedBenchSessions(sessionDir: string, cwd: string) {
  seedConversation(sessionDir, cwd, SHORT_SESSION_ID, SHORT_SESSION_NAME, SHORT_TURNS, "已记录。")
  seedConversation(sessionDir, cwd, LONG_SESSION_ID, LONG_SESSION_NAME, LONG_TURNS, LONG_REPLY)
  seedConversation(sessionDir, cwd, "bench-empty", EMPTY_SESSION_NAME, 0, "")
  seedConversation(
    sessionDir,
    cwd,
    "bench-stress",
    STRESS_SESSION_NAME,
    STRESS_TURNS,
    "## 处理结果\n\n| 项目 | 状态 |\n| --- | --- |\n| 历史 | 已加载 |\n\n```typescript\nconst value = 42\n```\n\n" +
      LONG_REPLY,
  )
}

export function sessionPrompt(name: string, turn = 1): string {
  return `${name} 提问 ${turn}`
}

function seedConversation(
  sessionDir: string,
  cwd: string,
  id: string,
  name: string,
  turns: number,
  reply: string,
) {
  const manager = SessionManager.create(cwd, sessionDir, { id })
  manager.appendSessionInfo(name)
  if (turns === 0) {
    const file = manager.getSessionFile()
    if (!file) throw new Error("空会话种子缺少文件路径")
    // SDK 会延迟到首条助手消息才落盘，空历史夹具显式写入公开条目。
    writeFileSync(
      file,
      [manager.getHeader(), ...manager.getEntries()]
        .map((entry) => JSON.stringify(entry))
        .join("\n") + "\n",
    )
  }
  const started = Date.now() - turns * 120_000
  for (let index = 0; index < turns; index += 1) {
    const timestamp = started + index * 120_000
    manager.appendMessage({
      role: "user",
      content: sessionPrompt(name, index + 1),
      timestamp,
    })
    manager.appendMessage(assistantMessage(reply, timestamp + 30_000))
    if (name === STRESS_SESSION_NAME && index % 10 === 0) {
      const call = assistantMessage("", timestamp + 40_000)
      call.content = [
        { type: "toolCall", id: `read-${index}`, name: "read", arguments: { path: "example.ts" } },
      ]
      call.stopReason = "toolUse"
      manager.appendMessage(call)
      manager.appendMessage({
        role: "toolResult",
        toolCallId: `read-${index}`,
        toolName: "read",
        content: [{ type: "text", text: "const value = 42\n".repeat(30) }],
        isError: false,
        timestamp: timestamp + 50_000,
      })
    }
  }
}
