import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { SessionManager } from "@earendil-works/pi-coding-agent"

export const COMPLEX_SESSION_ID = "e2e-complex"

export const COMPLEX_SESSION_NAME = "复杂会话"

export const COMPLEX_MARKER = "e2e 复杂样本"

export const TABLE_MARKER = "e2e-table"

export const FORMULA_MARKER = "e2e-formula"

export const MERMAID_MARKER = "e2e-mermaid"

export const TOOL_MARKER = "e2e-tool"

export const SHORT_BODY_SESSION_ID = "e2e-body-short"

export const SHORT_BODY_SESSION_NAME = "短末条"

export const SHORT_BODY_MARKER = "e2e 短末条可见"

/** 本机扫描后推荐：pig、135 条、表+Mermaid+工具、无密钥。PIG_FIXTURE_SESSION 可覆盖。 */
export const DEFAULT_FIXTURE_SESSION = join(
  homedir(),
  ".pi/agent/sessions/--G--AICode-pig--/2026-09-05T12-54-39-867Z_01a071a2-a5fa-7748-a64c-7ad5fe843205.jsonl",
)

type AppendMessage = Parameters<SessionManager["appendMessage"]>[0]

type AssistantMessage = Extract<AppendMessage, { role: "assistant" }>

const USAGE = {
  input: 1,
  output: 1,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 2,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
} as const

const MARKER_REPLY = `### ${TABLE_MARKER}

| 项目 | 状态 |
| --- | --- |
| 历史 | 已加载 |

### ${FORMULA_MARKER}

$$E = mc^2$$

### ${MERMAID_MARKER}

\`\`\`mermaid
flowchart LR
  A[${MERMAID_MARKER}] --> B[Transcript]
\`\`\`
`

function assistantMessage(
  content: AssistantMessage["content"],
  timestamp: number,
  stopReason: AssistantMessage["stopReason"] = "stop",
): AssistantMessage {
  return {
    role: "assistant",
    content,
    api: "openai-completions",
    provider: "test-provider",
    model: "test-model",
    usage: USAGE,
    stopReason,
    timestamp,
  }
}

function resolveSource(): string | undefined {
  const override = process.env.PIG_FIXTURE_SESSION?.trim()
  const path = override && override.length > 0 ? override : DEFAULT_FIXTURE_SESSION
  return existsSync(path) ? path : undefined
}

function appendMarkerTurn(manager: SessionManager, timestamp: number) {
  const toolId = "e2e-tool-1"
  manager.appendMessage({
    role: "user",
    content: COMPLEX_MARKER,
    timestamp,
  })
  manager.appendMessage(
    assistantMessage(
      [
        { type: "text", text: MARKER_REPLY },
        { type: "toolCall", id: toolId, name: "read", arguments: { path: "src/example.ts" } },
      ],
      timestamp + 1_000,
      "toolUse",
    ),
  )
  manager.appendMessage({
    role: "toolResult",
    toolCallId: toolId,
    toolName: "read",
    content: [{ type: "text", text: TOOL_MARKER }],
    isError: false,
    timestamp: timestamp + 2_000,
  })
  manager.appendMessage(
    assistantMessage([{ type: "text", text: `${TABLE_MARKER} 已写入时间线。` }], timestamp + 3_000),
  )
}

/** 把本机历史 fork 进测试 sessionDir；没有源文件时只写标记回合。用完由调用方删目录。 */
export function prebuildComplexSession(
  sessionDir: string,
  cwd: string,
): {
  id: string
  name: string
  forked: boolean
} {
  const source = resolveSource()

  const manager = source
    ? SessionManager.forkFrom(source, cwd, sessionDir, { id: COMPLEX_SESSION_ID })
    : SessionManager.create(cwd, sessionDir, { id: COMPLEX_SESSION_ID })

  manager.appendSessionInfo(COMPLEX_SESSION_NAME)
  appendMarkerTurn(manager, Date.now())
  const file = manager.getSessionFile()

  if (!file) throw new Error("预构建未写出会话文件")
  return { id: COMPLEX_SESSION_ID, name: COMPLEX_SESSION_NAME, forked: Boolean(source) }
}

/** 另一条已落盘短会话，供正文可见计时对照复杂历史。 */
export function seedShortBodySession(sessionDir: string, cwd: string) {
  const manager = SessionManager.create(cwd, sessionDir, { id: SHORT_BODY_SESSION_ID })
  manager.appendSessionInfo(SHORT_BODY_SESSION_NAME)
  const timestamp = Date.now()
  manager.appendMessage({ role: "user", content: "短问", timestamp })
  manager.appendMessage(
    assistantMessage([{ type: "text", text: SHORT_BODY_MARKER }], timestamp + 1_000),
  )
}
