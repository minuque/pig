import { SessionManager } from "@earendil-works/pi-coding-agent"

export const COMPLEX_SESSION_ID = "e2e-complex"
export const COMPLEX_SESSION_NAME = "复杂会话"
export const COMPLEX_MARKER = "e2e 复杂样本"
export const TABLE_MARKER = "e2e-table"
export const FORMULA_MARKER = "e2e-formula"
export const MERMAID_MARKER = "e2e-mermaid"
export const TOOL_MARKER = "e2e-tool"

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

const TOOL_KINDS = [
  { name: "read", args: (n: number) => ({ path: `src/module-${n}.ts` }) },
  { name: "bash", args: (n: number) => ({ command: `pnpm test --filter pkg-${n}` }) },
  { name: "ffgrep", args: (n: number) => ({ pattern: `symbol${n}`, path: "src" }) },
  {
    name: "edit",
    args: (n: number) => ({ path: `src/module-${n}.ts`, oldText: "a", newText: "b" }),
  },
  { name: "fffind", args: (n: number) => ({ pattern: `*-${n}.ts` }) },
  { name: "write", args: (n: number) => ({ path: `notes/step-${n}.md`, content: "# 记录" }) },
] as const
const HISTORY_TURNS = 12
const ROUNDS_PER_TURN = 3

function syntheticReply(turn: number): string {
  const paragraphs = Array.from(
    { length: 6 },
    (_, i) => `第 ${turn} 轮第 ${i + 1} 段：分析与结论。`,
  )

  if (turn % 3 === 0)
    paragraphs.push(
      `| 文件 | 改动 |\n| --- | --- |\n| module-${turn}.ts | 重命名 |\n| index.ts | 导出 |`,
    )

  if (turn % 4 === 0) paragraphs.push("```ts\nexport const answer = 42\n```")

  if (turn === 6)
    paragraphs.push("```mermaid\nflowchart LR\n  A[请求] --> B[处理] --> C[结果]\n```")
  return paragraphs.join("\n\n")
}

/** 合成的多轮历史：结构仿真实会话（思考、多种工具、表格、代码、Mermaid、一条长输出），内容是编的，各环境一致。 */
function appendSyntheticHistory(manager: SessionManager, start: number) {
  let time = start
  let call = 0

  for (let turn = 1; turn <= HISTORY_TURNS; turn += 1) {
    manager.appendMessage({
      role: "user",
      content: `第 ${turn} 个任务：整理模块 ${turn}`,
      timestamp: time++,
    })

    for (let round = 0; round < ROUNDS_PER_TURN; round += 1) {
      const tool = TOOL_KINDS[call % TOOL_KINDS.length]!
      const id = `e2e-history-${call}`
      const long = call === 10
      call += 1
      manager.appendMessage(
        assistantMessage(
          [
            {
              type: "thinking",
              thinking: `第 ${turn} 轮第 ${round + 1} 步：先看 ${tool.name} 的结果。`,
            },
            { type: "toolCall", id, name: tool.name, arguments: tool.args(call) },
          ],
          time++,
          "toolUse",
        ),
      )
      manager.appendMessage({
        role: "toolResult",
        toolCallId: id,
        toolName: tool.name,
        content: [
          { type: "text", text: long ? "长输出一行\n".repeat(3000) : `${tool.name} 完成 #${call}` },
        ],
        isError: false,
        timestamp: time++,
      })
    }

    manager.appendMessage(assistantMessage([{ type: "text", text: syntheticReply(turn) }], time++))
  }
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

/** 侧栏分页用例的会话名前缀。 */
export const FILLER_PREFIX = "批量会话"

/** 造 count 个同 cwd、同一天更新的会话，用来触发侧栏分页。 */
export function prebuildFillerSessions(
  sessionDir: string,
  cwd: string,
  count: number,
  idPrefix = "e2e-filler",
): { id: string; name: string }[] {
  const made: { id: string; name: string }[] = []

  for (let i = 0; i < count; i += 1) {
    const id = `${idPrefix}-${i}`
    const name = `${FILLER_PREFIX} ${i + 1}`
    // 落到过去，别让首帧把会话判成未读（runStartAt 按消息时间比较）
    const timestamp = Date.now() - 60_000 + i * 1_000
    const manager = SessionManager.create(cwd, sessionDir, { id })

    manager.appendSessionInfo(name)
    manager.appendMessage({ role: "user", content: `${name} 的内容`, timestamp })
    // SessionManager 要见到 assistant 消息才落盘
    manager.appendMessage(
      assistantMessage([{ type: "text", text: `${name} 的回复` }], timestamp + 1_000),
    )

    if (!manager.getSessionFile()) throw new Error(`未写出 ${id}`)
    made.push({ id, name })
  }

  return made
}

/** 合成多轮历史，再写标记回合。用完由调用方删目录。 */
export function prebuildComplexSession(
  sessionDir: string,
  cwd: string,
): { id: string; name: string } {
  const manager = SessionManager.create(cwd, sessionDir, { id: COMPLEX_SESSION_ID })

  manager.appendSessionInfo(COMPLEX_SESSION_NAME)
  appendSyntheticHistory(manager, Date.now() - 3_600_000)
  appendMarkerTurn(manager, Date.now())
  const file = manager.getSessionFile()

  if (!file) throw new Error("预构建未写出会话文件")
  return { id: COMPLEX_SESSION_ID, name: COMPLEX_SESSION_NAME }
}

export const EXTERNAL_SESSION_ID = "e2e-external"
export const EXTERNAL_SESSION_NAME = "外部回合会话"
export const EXTERNAL_PENDING_PROMPT = "e2e 别处正在跑的提问"
export const EXTERNAL_REPLY = "e2e 别处写入的回答"

/** 一个完整回合后再多一条用户消息：像 TUI 正跑到一半。返回会话文件路径。 */
export function prebuildExternalTurnSession(sessionDir: string, cwd: string): string {
  const manager = SessionManager.create(cwd, sessionDir, { id: EXTERNAL_SESSION_ID })
  const timestamp = Date.now() - 60_000

  manager.appendSessionInfo(EXTERNAL_SESSION_NAME)
  manager.appendMessage({ role: "user", content: "e2e 先前的提问", timestamp })
  manager.appendMessage(
    assistantMessage([{ type: "text", text: "e2e 先前的回答" }], timestamp + 1_000),
  )
  manager.appendMessage({
    role: "user",
    content: EXTERNAL_PENDING_PROMPT,
    timestamp: timestamp + 2_000,
  })
  const file = manager.getSessionFile()

  if (!file) throw new Error("预构建未写出会话文件")
  return file
}

/** 另开一个 SessionManager 追加一条收尾的助手消息：这就是外部写入方。 */
export function appendExternalReply(file: string) {
  SessionManager.open(file).appendMessage(
    assistantMessage([{ type: "text", text: EXTERNAL_REPLY }], Date.now()),
  )
}

export const CHILD_SESSION_ID = "e2e-child"
export const CHILD_MARKER = "子任务里读到了协议层"

/** subagent 开出的子会话：带 pig.subagent 标记，侧栏不列，只能从子任务卡片点开。 */
export function prebuildChildSession(sessionDir: string, cwd: string) {
  const manager = SessionManager.create(cwd, sessionDir, { id: CHILD_SESSION_ID })
  const timestamp = Date.now() - 30_000
  manager.appendCustomEntry("pig.subagent", { agent: "scout" })
  manager.appendMessage({ role: "user", content: "摸清协议层", timestamp })
  manager.appendMessage(assistantMessage([{ type: "text", text: CHILD_MARKER }], timestamp + 1_000))
}
