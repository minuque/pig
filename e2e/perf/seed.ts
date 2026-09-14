import { SessionManager } from "@earendil-works/pi-coding-agent"
import { writeFileSync } from "node:fs"

export const SHORT_SESSION_ID = "bench-short"

export const LONG_SESSION_ID = "bench-long"

export const EMPTY_SESSION_ID = "bench-empty"

export const TOOL_SESSION_ID = "bench-tools"

export const SHORT_SESSION_NAME = "短会话"

export const LONG_SESSION_NAME = "长会话"

export const EMPTY_SESSION_NAME = "空会话"

export const TOOL_SESSION_NAME = "工具步骤会话"

export const SHORT_TURNS = 2

export const LONG_TURNS = 50

export const TOOL_STEPS = 17

export const LIST_SESSION_COUNT = 40

const SESSIONS = {
  [SHORT_SESSION_NAME]: { id: SHORT_SESSION_ID, turns: SHORT_TURNS },
  [LONG_SESSION_NAME]: { id: LONG_SESSION_ID, turns: LONG_TURNS },
  [EMPTY_SESSION_NAME]: { id: EMPTY_SESSION_ID, turns: 0 },
  [TOOL_SESSION_NAME]: { id: TOOL_SESSION_ID, turns: 1 },
} as const

export const BENCH_SESSION_TOTAL = LIST_SESSION_COUNT + Object.keys(SESSIONS).length

export type BenchSessionName = keyof typeof SESSIONS

export function sessionIdOf(name: BenchSessionName): string {
  return SESSIONS[name].id
}

export function sessionTurns(name: BenchSessionName): number {
  return SESSIONS[name].turns
}

type AppendMessage = Parameters<SessionManager["appendMessage"]>[0]

type AssistantMessage = Extract<AppendMessage, { role: "assistant" }>

type AssistantContent = AssistantMessage["content"]

const PLAIN_REPLY = "把 Snapshot 投到时间线，把 Composer 留在底栏。".repeat(3)

const MARKDOWN_REPLY = `## 处理结果

| 项目 | 状态 |
| --- | --- |
| 历史 | 已加载 |

\`\`\`typescript
const value = 42
\`\`\`

${PLAIN_REPLY}`

type SeedTool = {
  id: string
  name: string
  args: Record<string, unknown>
  output: string
}

function assistantMessage(
  content: AssistantContent,
  timestamp: number,
  stopReason: AssistantMessage["stopReason"] = "stop",
): AssistantMessage {
  return {
    role: "assistant",
    content,
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
    stopReason,
    timestamp,
  }
}

function toolFor(index: number): SeedTool | undefined {
  if (index % 5 !== 0) return undefined
  const id = `tool-${index}`
  const kind = (index / 5) % 3

  if (kind === 0)
    return {
      id,
      name: "read",
      args: { path: "src/example.ts" },
      output: "const value = 42\n".repeat(30),
    }

  if (kind === 1)
    return {
      id,
      name: "bash",
      args: { command: "git status" },
      output: "On branch master\nnothing to commit, working tree clean\n",
    }
  return {
    id,
    name: "edit",
    args: { path: "src/example.ts", oldText: "const value = 42", newText: "const value = 43" },
    output: "updated",
  }
}

function appendAgentTurn(manager: SessionManager, index: number, timestamp: number, reply: string) {
  const thinking =
    index % 3 === 0
      ? { type: "thinking" as const, thinking: `先看第 ${index + 1} 轮要不要动工具。` }
      : undefined

  const tool = toolFor(index)

  if (tool) {
    const content: AssistantContent = thinking ? [thinking] : []
    content.push({ type: "toolCall", id: tool.id, name: tool.name, arguments: tool.args })
    manager.appendMessage(assistantMessage(content, timestamp + 20_000, "toolUse"))
    manager.appendMessage({
      role: "toolResult",
      toolCallId: tool.id,
      toolName: tool.name,
      content: [{ type: "text", text: tool.output }],
      isError: false,
      timestamp: timestamp + 25_000,
    })
    manager.appendMessage(assistantMessage([{ type: "text", text: reply }], timestamp + 30_000))
    return
  }

  const content: AssistantContent = thinking
    ? [thinking, { type: "text", text: reply }]
    : [{ type: "text", text: reply }]

  manager.appendMessage(assistantMessage(content, timestamp + 30_000))
}

function seedListSessions(sessionDir: string, cwd: string) {
  for (let index = 0; index < LIST_SESSION_COUNT; index += 1) {
    const n = index + 1
    seedConversation(
      sessionDir,
      cwd,
      `bench-list-${String(n).padStart(2, "0")}`,
      `列表会话 ${n}`,
      0,
      "",
    )
  }
}

/** 在 sessionDir 写入短/长会话和侧栏列表填充，供打开、切换、滚动测量。 */
export function seedBenchSessions(sessionDir: string, cwd: string) {
  seedListSessions(sessionDir, cwd)
  seedConversation(sessionDir, cwd, SHORT_SESSION_ID, SHORT_SESSION_NAME, SHORT_TURNS, "已记录。")
  seedConversation(
    sessionDir,
    cwd,
    LONG_SESSION_ID,
    LONG_SESSION_NAME,
    LONG_TURNS,
    MARKDOWN_REPLY,
    true,
  )
  seedConversation(sessionDir, cwd, EMPTY_SESSION_ID, EMPTY_SESSION_NAME, 0, "")
  seedToolStepsSession(sessionDir, cwd)
}

function seedToolStepsSession(sessionDir: string, cwd: string) {
  const manager = SessionManager.create(cwd, sessionDir, { id: TOOL_SESSION_ID })
  manager.appendSessionInfo(TOOL_SESSION_NAME)
  const timestamp = Date.now() - 120_000
  manager.appendMessage({
    role: "user",
    content: sessionPrompt(TOOL_SESSION_NAME),
    timestamp,
  })

  for (let index = 0; index < TOOL_STEPS; index += 1) {
    const id = `tool-step-${index + 1}`
    const path = `src/fixture-${index + 1}.ts`
    manager.appendMessage(
      assistantMessage(
        [{ type: "toolCall", id, name: "read", arguments: { path } }],
        timestamp + index * 2_000 + 1_000,
        "toolUse",
      ),
    )
    manager.appendMessage({
      role: "toolResult",
      toolCallId: id,
      toolName: "read",
      content: [{ type: "text", text: `export const fixture${index + 1} = true\n` }],
      isError: false,
      timestamp: timestamp + index * 2_000 + 1_500,
    })
  }

  manager.appendMessage(
    assistantMessage(
      [{ type: "text", text: "工具步骤已完成。" }],
      timestamp + TOOL_STEPS * 2_000 + 1_000,
    ),
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
  agent = false,
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

    if (agent) appendAgentTurn(manager, index, timestamp, reply)
    else
      manager.appendMessage(assistantMessage([{ type: "text", text: reply }], timestamp + 30_000))
  }
}
