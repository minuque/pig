import type {
  AssistantTranscriptItem,
  SessionMetadata,
  ToolTranscriptItem,
  TranscriptItem,
  UserTranscriptItem,
} from "@/types/common-type.js"
import type { TurnTiming } from "@/types/turn-type.js"
import { sidebarSections, toSidebarSession } from "@features/session-nav/lib/session-list.js"
import type {
  SessionCardExtra,
  SidebarSection,
  SidebarSession,
  SidebarSessionState,
} from "@features/session-nav/type.js"

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

type AssistantContent = AssistantTranscriptItem["content"]

type AssistantBlock = AssistantContent[number]

type AssistantStatus = AssistantTranscriptItem["status"]

/** 正文时间基准固定，时间戳不随运行漂移，像素基线才可重复。 */
export const TRANSCRIPT_EPOCH = new Date(2025, 0, 6, 9, 0, 0).getTime()
export const SAMPLE_MODEL = { provider: "anthropic", id: "claude-sonnet-4-5" }
const SAMPLE_USAGE: NonNullable<AssistantTranscriptItem["usage"]> = {
  input: 12_480,
  output: 1_860,
  cacheRead: 9_600,
  cacheWrite: 1_200,
  totalTokens: 25_140,
  cost: { input: 0.037, output: 0.028, cacheRead: 0.003, cacheWrite: 0.004, total: 0.072 },
}

/** text / thinking / toolCall 正文块。 */
export function textBlock(text: string): AssistantBlock {
  return { type: "text", text }
}

export function thinkingBlock(thinking: string): AssistantBlock {
  return { type: "thinking", thinking }
}

export function toolCallBlock(
  toolCallId: string,
  toolName: string,
  input: ToolTranscriptItem["input"],
): AssistantBlock {
  return { type: "toolCall", toolCallId, toolName, input }
}

/** 一条用户消息；id 由角色加时间戳派生，时间戳互不相同即可。 */
export function userItem(text: string, timestamp: number): UserTranscriptItem {
  return { id: `user-${timestamp}`, role: "user", content: [{ type: "text", text }], timestamp }
}

/** 一条助手消息；status 决定 stopReason 与 errorMessage 分支。 */
export function assistantItem(
  content: AssistantContent,
  timestamp: number,
  status: AssistantStatus = "complete",
): AssistantTranscriptItem {
  const base = {
    id: `assistant-${timestamp}`,
    role: "assistant" as const,
    content,
    model: SAMPLE_MODEL,
    usage: SAMPLE_USAGE,
    timestamp,
  }
  const errorMessage = "供应商返回 429：请求速率超限，请稍后重试。"

  if (status === "streaming") return { ...base, status }

  if (status === "error") return { ...base, status, stopReason: "error", errorMessage }

  if (status === "aborted")
    return { ...base, status, stopReason: "aborted", errorMessage: "用户中断了本轮。" }
  const hasToolCall = content.some((block) => block.type === "toolCall")
  return { ...base, status, stopReason: hasToolCall ? "toolUse" : "stop" }
}

/** 一条工具结果消息。 */
export function toolItem(options: {
  toolCallId: string
  toolName: string
  input: ToolTranscriptItem["input"]
  output: string
  timestamp: number
  status?: "running" | "complete" | "error"
}): ToolTranscriptItem {
  const { toolCallId, toolName, input, output, timestamp, status = "complete" } = options
  const base = {
    id: `${toolCallId}-result`,
    role: "tool" as const,
    toolCallId,
    toolName,
    input,
    content: [{ type: "text" as const, text: output }],
    timestamp,
  }

  if (status === "running") return { ...base, status, isError: false }

  if (status === "error") return { ...base, status, isError: true }
  return { ...base, status, isError: false }
}

export const MARKDOWN_REPLY = `## 分组结果

| 分区 | 条数 | 说明 |
| --- | --- | --- |
| 置顶 | 2 | 顺序由 pinnedOrder 决定 |
| 今天 | 5 | 本地零点之后 |
| 更早 | 3 | 超过七天 |

\`\`\`typescript
export function sortSessionsForSidebar(sessions: readonly SessionMetadata[]): SessionMetadata[] {
  return [...sessions].sort((left, right) => sessionRecency(right) - sessionRecency(left))
}
\`\`\`

日期桶只影响展示，messageCount 仍取协议快照。`
const PLAIN_REPLIES = [
  "排序集中在 sortSessionsForSidebar，置顶段和日期桶都在它上面拼。",
  "日期桶以本地零点为界，直接用 updatedAt 相减会掉进前一个桶。",
  "工具卡的状态行由 splitCommandStatus 拆出，exit code 为 0 时不显示脚注。",
]
/** 22 条提问，长会话每轮一条，短会话取前几条。 */
const PROMPTS = [
  "看一下会话侧栏的排序实现，找出日期分组错位的原因。",
  "把日期桶的时间基准改成当天零点。",
  "跑一下单测，确认排序没被改坏。",
  "整理这次改动的表格，我要贴到 PR 里。",
  "现在看侧栏的置顶段，拖拽后顺序没保存。",
  "把 pinnedOrder 的写盘时机挪到拖拽结束。",
  "再跑一次单测。",
  "把置顶顺序的存储格式也换成 id 数组。",
  "看工具卡的折叠动画，展开时会跳一下。",
  "确认一下折叠高度是怎么量的。",
  "改成读 scrollHeight 之前先等一帧。",
  "跑一遍工具卡相关的故事。",
  "整理一下这轮改动的结论。",
  "检索一下所有还在用旧字段的地方。",
  "把旧字段的读取点全部换成新的。",
  "跑全量单测，看还有没有遗漏。",
  "检查一下类型定义有没有重复。",
  "把重复的类型删掉，改成复用 common-type。",
  "再跑一次类型检查。",
  "看侧栏的搜索，目录名匹配不到。",
  "把搜索的匹配范围扩到规范化路径。",
  "跑完单测把结果汇总成一张表。",
]
const READ_OUTPUT = `const dateBucket = (session, sort, now) => {
  const age = localDayStart(now) - sortKey(session, sort)

  if (age < 0) return 0

  if (age < DAY) return 1
  return 3
}

[48 more lines in file. Use offset=148 to continue.]`
const BASH_OUTPUT = ` Test Files  12 passed (12)
      Tests  164 passed (164)
   Duration  4.12s

Command exited with code 0`
const EDIT_PATH = "apps/web/src/features/session-nav/lib/session-list.ts"
const OLD_LINE = "  const age = now - sortKey(session, sort)"
const NEW_LINE = "  const age = localDayStart(now) - sortKey(session, sort)"

type ToolSeed = { name: string; input: ToolTranscriptItem["input"]; output: string }

const TOOL_SEEDS: readonly ToolSeed[] = [
  { name: "read", input: { path: EDIT_PATH, offset: 100, limit: 40 }, output: READ_OUTPUT },
  {
    name: "bash",
    input: { command: "pnpm --filter @pig/web test", description: "跑 web 单测" },
    output: BASH_OUTPUT,
  },
  {
    name: "edit",
    input: { path: EDIT_PATH, oldText: OLD_LINE, newText: NEW_LINE },
    output: `已更新 ${EDIT_PATH}`,
  },
]

function replyFor(index: number): string {
  if (index % 4 === 3) return MARKDOWN_REPLY
  return PLAIN_REPLIES[index % PLAIN_REPLIES.length] ?? ""
}

export const SHORT_TURNS = 2
export const LONG_TURNS = 22
const TURN_GAP = 4 * MINUTE

/** 轮次样本：每轮一条提问加一条回答，withTools 时插入 read / bash / edit 工具卡。 */
export function createTranscript(options: {
  turns: number
  start?: number
  withTools?: boolean
  withThinking?: boolean
}): TranscriptItem[] {
  const { turns, start = TRANSCRIPT_EPOCH, withTools = false, withThinking = false } = options
  const items: TranscriptItem[] = []

  for (let index = 0; index < turns; index += 1) {
    const base = start + index * TURN_GAP
    const tool = withTools ? TOOL_SEEDS[index % TOOL_SEEDS.length] : undefined
    const thinking: AssistantBlock[] =
      withThinking && index % 3 === 0
        ? [thinkingBlock(`第 ${index + 1} 轮先确认影响面，再决定改哪一层。`)]
        : []
    const prompt = PROMPTS[index % PROMPTS.length] ?? ""

    items.push(userItem(prompt, base))

    if (!tool) {
      items.push(assistantItem([...thinking, textBlock(replyFor(index))], base + 45 * SECOND))
      continue
    }

    const toolCallId = `call-${index}`
    const call = toolCallBlock(toolCallId, tool.name, tool.input)

    items.push(assistantItem([...thinking, call], base + 20 * SECOND))
    items.push(
      toolItem({
        toolCallId,
        toolName: tool.name,
        input: tool.input,
        output: tool.output,
        timestamp: base + 35 * SECOND,
      }),
    )
    items.push(assistantItem([textBlock(replyFor(index))], base + 70 * SECOND))
  }

  return items
}

export const EMPTY_TRANSCRIPT: TranscriptItem[] = []
export const SHORT_TRANSCRIPT = createTranscript({ turns: SHORT_TURNS })
export const LONG_TRANSCRIPT = createTranscript({
  turns: LONG_TURNS,
  withTools: true,
  withThinking: true,
})
export const TOOL_STEPS = 17

/** 单轮多步工具：验证工具卡堆叠与汇总行。 */
export function toolStepsTranscript(
  steps = TOOL_STEPS,
  start = TRANSCRIPT_EPOCH,
): TranscriptItem[] {
  const items: TranscriptItem[] = [
    userItem("把 fixtures 目录下的文件逐个读一遍，确认没有遗留的 TODO。", start),
  ]

  for (let index = 0; index < steps; index += 1) {
    const toolCallId = `step-${index + 1}`
    const path = `apps/web/src/stories/fixtures/file-${index + 1}.ts`
    const at = start + index * 20 * SECOND
    const output = `export const file${index + 1} = true\n`

    items.push(assistantItem([toolCallBlock(toolCallId, "read", { path })], at + 10 * SECOND))
    items.push(
      toolItem({
        toolCallId,
        toolName: "read",
        input: { path },
        output,
        timestamp: at + 15 * SECOND,
      }),
    )
  }

  const done = start + steps * 20 * SECOND + 10 * SECOND
  items.push(assistantItem([textBlock(`${steps} 个文件都读完了，没有遗留的 TODO。`)], done))
  return items
}

export const TOOL_STEPS_TRANSCRIPT = toolStepsTranscript()
const LIVE_COMMAND = "pnpm --filter @pig/web test:stories"
/** 流式进行中：最后一条助手仍在输出，倒数第二条是运行中的工具卡。 */
export const STREAMING_TRANSCRIPT: TranscriptItem[] = [
  userItem("把长会话的滚动位置固定在底部。", TRANSCRIPT_EPOCH),
  assistantItem(
    [textBlock("固定底部只需要在 follow 状态里对齐 scrollTop，先确认现在的触发点。")],
    TRANSCRIPT_EPOCH + 40 * SECOND,
  ),
  userItem("流式内容进来时别让高度跳动。", TRANSCRIPT_EPOCH + TURN_GAP),
  assistantItem(
    [toolCallBlock("call-live", "bash", { command: LIVE_COMMAND })],
    TRANSCRIPT_EPOCH + TURN_GAP + 20 * SECOND,
  ),
  toolItem({
    toolCallId: "call-live",
    toolName: "bash",
    input: { command: LIVE_COMMAND },
    output: "\n RUN  v5.0.5 G:/AICode/pig/apps/web\n\n 正在收集故事…",
    timestamp: TRANSCRIPT_EPOCH + TURN_GAP + 25 * SECOND,
    status: "running",
  }),
  assistantItem(
    [
      thinkingBlock("先量一次行高，再决定要不要用 ResizeObserver 兜住尾部内容。"),
      textBlock(
        "## 处理中\n\n| 项目 | 状态 |\n| --- | --- |\n| 行高测量 | 已定位 |\n\n先把 follow",
      ),
    ],
    TRANSCRIPT_EPOCH + TURN_GAP + 30 * SECOND,
    "streaming",
  ),
]
/** 进行中那一轮的 timing：只给最后一轮 running。 */
export const RUNNING_TIMINGS = transcriptTimings(STREAMING_TRANSCRIPT, { runningLast: true })
/** 错误：最后一条助手只有 errorMessage，没有正文。 */
export const ERROR_TRANSCRIPT: TranscriptItem[] = [
  userItem("把长会话打开，量一次首屏时间。", TRANSCRIPT_EPOCH),
  assistantItem(
    [textBlock("先确认会话文件大小，再决定分页窗口。")],
    TRANSCRIPT_EPOCH + 40 * SECOND,
  ),
  userItem("继续。", TRANSCRIPT_EPOCH + TURN_GAP),
  assistantItem([], TRANSCRIPT_EPOCH + TURN_GAP + 30 * SECOND, "error"),
]
/** 中断：最后一条助手有半句正文，状态为 aborted。 */
export const ABORTED_TRANSCRIPT: TranscriptItem[] = [
  userItem("把 transcript-window 的窗口大小调大一档。", TRANSCRIPT_EPOCH),
  assistantItem([textBlock("先看窗口大小常量，再决定改哪一档。")], TRANSCRIPT_EPOCH + 40 * SECOND),
  userItem("直接改。", TRANSCRIPT_EPOCH + TURN_GAP),
  assistantItem(
    [textBlock("已把窗口从 40 调到 60，接下来同步虚拟列表的估算高度，然后")],
    TRANSCRIPT_EPOCH + TURN_GAP + 30 * SECOND,
    "aborted",
  ),
]

/** 轮的起止时间；runningLast 与 lastOutcome 只改最后一轮。 */
export function transcriptTimings(
  items: readonly TranscriptItem[],
  options: { runningLast?: boolean; lastOutcome?: "complete" | "error" | "aborted" } = {},
): TurnTiming[] {
  const { runningLast = false, lastOutcome = "complete" } = options
  const turns: { userId: string; startedAt: number; endedAt: number }[] = []

  for (const item of items) {
    if (item.role === "user") {
      turns.push({ userId: item.id, startedAt: item.timestamp, endedAt: item.timestamp })
      continue
    }

    const current = turns.at(-1)

    if (current) current.endedAt = Math.max(current.endedAt, item.timestamp)
  }

  return turns.map((turn, index) => {
    if (runningLast && index === turns.length - 1)
      return { userId: turn.userId, startedAt: turn.startedAt, outcome: "running" }

    const outcome = index === turns.length - 1 ? lastOutcome : "complete"
    return { userId: turn.userId, startedAt: turn.startedAt, outcome, endedAt: turn.endedAt }
  })
}

/** TranscriptBody 的一组入参。 */
export type TranscriptSample = {
  sessionId: string
  transcript: TranscriptItem[]
  running: boolean
  timings: TurnTiming[]
}

function sample(
  kind: string,
  transcript: TranscriptItem[],
  extra: { running?: boolean; timings?: TurnTiming[] } = {},
): TranscriptSample {
  return {
    sessionId: `story-${kind}`,
    transcript,
    running: extra.running ?? false,
    timings: extra.timings ?? transcriptTimings(transcript),
  }
}

export const TRANSCRIPT_SAMPLES = {
  empty: sample("empty", EMPTY_TRANSCRIPT),
  short: sample("short", SHORT_TRANSCRIPT),
  long: sample("long", LONG_TRANSCRIPT),
  toolSteps: sample("tools", TOOL_STEPS_TRANSCRIPT),
  streaming: sample("streaming", STREAMING_TRANSCRIPT, { running: true, timings: RUNNING_TIMINGS }),
  error: sample("error", ERROR_TRANSCRIPT, {
    timings: transcriptTimings(ERROR_TRANSCRIPT, { lastOutcome: "error" }),
  }),
  aborted: sample("aborted", ABORTED_TRANSCRIPT, {
    timings: transcriptTimings(ABORTED_TRANSCRIPT, { lastOutcome: "aborted" }),
  }),
} satisfies Record<string, TranscriptSample>

export type TranscriptKind = keyof typeof TRANSCRIPT_SAMPLES

/** 侧栏样本时刻，晚于正文基准，保证日期桶落在今天。 */
export const SIDEBAR_NOW = Date.now()
const AGENTS_CWD = "G:\\AICode\\pig"
const GATEWAY_CWD = "G:\\AICode\\pi-gateway"
const DOCS_CWD = "G:\\AICode\\bird-docs"
export const SIDEBAR_WORKSPACES = [AGENTS_CWD, GATEWAY_CWD, DOCS_CWD]

function midnightOf(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const MIDNIGHT = midnightOf(SIDEBAR_NOW)
/** 相对本地零点定位，昨天与更早的桶不会因为运行时刻漂移。 */
const YESTERDAY = MIDNIGHT - 2 * HOUR

function meta(
  id: string,
  sessionName: string,
  cwd: string,
  updatedAt: number,
  createdAt = updatedAt - 3 * HOUR,
): SessionMetadata {
  return { id, sessionName, cwd, createdAt, updatedAt }
}

export const SIDEBAR_SESSIONS: SessionMetadata[] = [
  meta("sess-sidebar-sort", "侧栏排序改成按最近活动", AGENTS_CWD, SIDEBAR_NOW - 4 * MINUTE),
  meta("sess-storybook", "Storybook 基建：样本数据与装饰器", AGENTS_CWD, SIDEBAR_NOW - 25 * MINUTE),
  meta("sess-unread", "工具卡折叠动画收尾", AGENTS_CWD, SIDEBAR_NOW - 2 * HOUR),
  meta("sess-running", "流式输出的滚动跟随", AGENTS_CWD, SIDEBAR_NOW - 6 * HOUR),
  meta("sess-error", "PWA 缓存把旧包留在前台", AGENTS_CWD, SIDEBAR_NOW - 20 * HOUR),
  meta("sess-gateway-static", "静态资源路径改到 dist 目录", GATEWAY_CWD, YESTERDAY),
  meta("sess-gateway-proxy", "代理补上启动凭证", GATEWAY_CWD, YESTERDAY - 3 * HOUR),
  meta("sess-gateway-reload", "会话列表刷新时机", GATEWAY_CWD, MIDNIGHT - 3 * DAY),
  meta("sess-docs-storybook", "补 Storybook 使用说明", DOCS_CWD, MIDNIGHT - 4 * DAY),
  meta("sess-docs-tokens", "token 命名对齐", DOCS_CWD, MIDNIGHT - 12 * DAY),
]
export const SIDEBAR_PINNED_IDS = ["sess-storybook", "sess-sidebar-sort"]
export const SIDEBAR_ROWS: SidebarSession[] = SIDEBAR_SESSIONS.map(toSidebarSession)
export const SIDEBAR_SESSION_STATES: Readonly<Record<string, SidebarSessionState>> = {
  "sess-running": "running",
  "sess-error": "error",
  "sess-unread": "unread",
}
export const SIDEBAR_CARD_EXTRAS: ReadonlyMap<string, SessionCardExtra> = new Map([
  ["sess-sidebar-sort", { messageCount: 38, model: SAMPLE_MODEL, outcome: "complete" }],
  ["sess-storybook", { messageCount: 12, model: SAMPLE_MODEL, outcome: "complete" }],
  ["sess-unread", { messageCount: 24, model: SAMPLE_MODEL, outcome: "complete" }],
  ["sess-running", { messageCount: 9, model: SAMPLE_MODEL }],
  ["sess-error", { messageCount: 6, model: SAMPLE_MODEL, outcome: "error" }],
  ["sess-gateway-static", { messageCount: 31, model: SAMPLE_MODEL, outcome: "complete" }],
])

/** 日期分组：置顶 → 今天 → 昨天 → 近七天 → 更早。 */
export function sidebarDateSections(): SidebarSection[] {
  return sidebarSections({
    sessions: SIDEBAR_SESSIONS,
    pinnedOrder: SIDEBAR_PINNED_IDS,
    grouping: "date",
    sort: "updated",
    localWorkspaces: SIDEBAR_WORKSPACES,
    expandedByGroup: {},
    now: SIDEBAR_NOW,
  })
}

/** 工作目录分组：组内按最近活动排序，组名取目录名。 */
export function sidebarWorkspaceSections(): SidebarSection[] {
  return sidebarSections({
    sessions: SIDEBAR_SESSIONS,
    pinnedOrder: SIDEBAR_PINNED_IDS,
    grouping: "cwd",
    sort: "updated",
    localWorkspaces: SIDEBAR_WORKSPACES,
    expandedByGroup: {},
    now: SIDEBAR_NOW,
  })
}

export const SIDEBAR_DATE_SECTIONS = sidebarDateSections()
export const SIDEBAR_WORKSPACE_SECTIONS = sidebarWorkspaceSections()
