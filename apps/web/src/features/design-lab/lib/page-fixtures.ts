import type {
  ContextUsageEstimate,
  SessionMetadata,
  Task,
  TranscriptItem,
  TurnTiming,
} from "@/types/common-type.js"
import type { ExtensionUiDialog } from "@pig/protocol"
import type { ComposerPreset, ComposerVendor } from "@features/composer/type.js"
import type { SessionGroup, SidebarPlacement, SidebarRowFoot } from "@features/session-nav/type.js"
import { PROSE } from "@features/design-lab/lib/fixtures.js"

const NOW = Date.now()
const MIN = 60_000
const PIG = "G:/AICode/pig"
const KUMO = "G:/AICode/kumo"
const SONNET = { provider: "anthropic", id: "claude-sonnet-4-5" }
const GPT = { provider: "openai", id: "gpt-5" }
const ZERO_USAGE = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
}
export const PAGE_SESSION_ID = "page-current"

function session(id: string, name: string, cwd: string, ago: number): SessionMetadata {
  return { id, sessionName: name, cwd, createdAt: NOW - ago * MIN, updatedAt: NOW - ago * MIN }
}

export const PAGE_HISTORY_FAILED_ID = "page-history-failed"
export const PAGE_SESSIONS: SessionMetadata[] = [
  session(PAGE_SESSION_ID, "布局密度：compact / normal", PIG, 1),
  session("page-pinned", "发版清单", PIG, 300),
  session("page-pinned-2", "拖拽波纹手感", PIG, 240),
  session("page-pinned-3", "设计变量巡检", KUMO, 180),
  session("page-running", "侧栏虚拟滚动", PIG, 3),
  session("page-unread", "Banner 文案收敛", KUMO, 12),
  session("page-error", "gateway 断线重连", PIG, 25),
  session("page-plain", "Select 组件对齐", KUMO, 90),
  session(PAGE_HISTORY_FAILED_ID, "历史记录读取失败", KUMO, 180),
  session("page-settled-1", "toast 关闭按钮", PIG, 1440),
  session("page-settled-2", "图标库切换到 lucide", KUMO, 2880),
]
export const PAGE_GROUPS: SessionGroup[] = [
  { canonicalPath: PIG, sessions: PAGE_SESSIONS.filter((item) => item.cwd === PIG) },
  { canonicalPath: KUMO, sessions: PAGE_SESSIONS.filter((item) => item.cwd === KUMO) },
]
export const PAGE_PINNED = ["page-pinned", "page-pinned-2", "page-pinned-3"]
const RUNNING = new Set([PAGE_SESSION_ID, "page-running"])

export function pagePlacement(id: string): SidebarPlacement {
  return { running: RUNNING.has(id), settled: id.startsWith("page-settled") }
}

export const PAGE_FOOTS = new Map<string, SidebarRowFoot>([
  [PAGE_SESSION_ID, { state: "running", model: SONNET, messageCount: 18 }],
  ["page-pinned", { state: undefined, model: GPT, messageCount: 42 }],
  ["page-pinned-2", { state: undefined, model: SONNET, messageCount: 11 }],
  ["page-pinned-3", { state: "unread", model: GPT, messageCount: 7 }],
  [
    "page-running",
    {
      state: "running",
      model: SONNET,
      messageCount: 9,
      git: { branch: "feat/sidebar-virtual-scroll", detached: false, worktree: false },
    },
  ],
  ["page-unread", { state: "unread", model: GPT, messageCount: 6 }],
  ["page-error", { state: "error", model: SONNET, messageCount: 14 }],
  [
    "page-plain",
    {
      state: undefined,
      model: SONNET,
      messageCount: 23,
      git: { branch: "review/select-align", detached: false, worktree: true },
      parent: {
        id: "page-unread",
        title: "Banner 文案收敛",
        cwd: KUMO,
        updatedAt: NOW - 12 * MIN,
        model: GPT,
      },
    },
  ],
])
export const PAGE_RUNNING_SINCE: Record<string, number> = {
  [PAGE_SESSION_ID]: NOW - 40_000,
  "page-running": NOW - 3 * MIN,
}

function tool(
  id: string,
  toolName: string,
  input: Record<string, string>,
  output: string,
  status: "complete" | "error" | "running" = "complete",
): TranscriptItem {
  const base = {
    id,
    role: "tool" as const,
    toolCallId: id,
    toolName,
    input,
    content: output ? [{ type: "text" as const, text: output }] : [],
    timestamp: NOW - 6 * MIN,
  }

  if (status === "error") return { ...base, status, isError: true }
  return { ...base, status, isError: false }
}

function calls(...items: [string, string, Record<string, string>][]) {
  return items.map(([toolCallId, toolName, input]) => ({
    type: "toolCall" as const,
    toolCallId,
    toolName,
    input,
  }))
}

export const PAGE_TRANSCRIPT: TranscriptItem[] = [
  {
    id: "u1",
    role: "user",
    content: [{ type: "text", text: "把界面字号换成 compact / normal 两档布局密度，L 档删掉。" }],
    timestamp: NOW - 9 * MIN,
  },
  {
    id: "a1",
    role: "assistant",
    model: SONNET,
    status: "complete",
    stopReason: "toolUse",
    usage: ZERO_USAGE,
    timestamp: NOW - 8 * MIN,
    content: [
      { type: "thinking", thinking: "先找 uiSize 的数据路径，再看 token 怎么覆盖。" },
      ...calls(
        ["t-read", "read", { path: "packages/ui/src/styles/tokens.css" }],
        ["t-grep", "grep", { pattern: "uiSize", path: "apps/web/src" }],
        ["t-edit", "edit", { path: "packages/ui/src/core/types.ts" }],
        ["t-bash", "bash", { command: "pnpm check:touched" }],
        ["t-mcp", "browser_screenshot", { url: "localhost:5555/design" }],
      ),
    ],
  },
  tool("t-read", "read", { path: "packages/ui/src/styles/tokens.css" }, "--control-sm: 28px;"),
  tool("t-grep", "grep", { pattern: "uiSize" }, "preferences.ts:25\nAppearancePane.vue:64"),
  tool("t-edit", "edit", { path: "packages/ui/src/core/types.ts" }, "Applied 1 edit"),
  tool("t-bash", "bash", { command: "pnpm check:touched" }, "check passed"),
  tool("t-mcp", "browser_screenshot", { url: "localhost:5555" }, "connection refused", "error"),
  {
    id: "a2",
    role: "assistant",
    model: SONNET,
    status: "complete",
    stopReason: "stop",
    usage: ZERO_USAGE,
    timestamp: NOW - 7 * MIN,
    content: [{ type: "text", text: PROSE }],
  },
  {
    id: "s1",
    role: "system",
    timestamp: NOW - 6 * MIN,
    event: { kind: "model_change", model: GPT, previous: SONNET },
  },
  {
    id: "s2",
    role: "system",
    timestamp: NOW - 6 * MIN,
    event: {
      kind: "compaction",
      tokensBefore: 128_400,
      summary: "- 目标：布局密度\n- 进度：token 已落地",
    },
  },
  {
    id: "s3",
    role: "system",
    timestamp: NOW - 5 * MIN,
    event: { kind: "extension_notice", level: "warning", message: "3 个文件未通过格式检查" },
  },
  {
    id: "s4",
    role: "system",
    timestamp: NOW - 5 * MIN,
    event: {
      kind: "extension_message",
      customType: "review-bot",
      content: [{ type: "text", text: "发现 1 处可能的空指针：`transcript.ts:118` 未判空" }],
    },
  },
  {
    id: "k1",
    role: "task",
    timestamp: NOW - 4 * MIN,
    task: {
      id: "bash:lint",
      kind: "bash",
      description: "pnpm lint",
      status: "completed",
      command: "pnpm lint",
      output: "0 problems",
      exitCode: 0,
      startedAt: NOW - 5 * MIN,
      completedAt: NOW - 4 * MIN,
    },
  },
  {
    id: "u-long",
    role: "user",
    content: [
      {
        type: "text",
        text: Array.from(
          { length: 8 },
          (_, index) => `${index + 1}. 第 ${index + 1} 条要求：保持外观一致。`,
        ).join("\n"),
      },
    ],
    timestamp: NOW - 3 * MIN,
  },
  {
    id: "a-error",
    role: "assistant",
    model: GPT,
    status: "error",
    stopReason: "error",
    errorMessage:
      '429 {"type":"error","error":{"type":"rate_limit_error","message":"Number of request tokens has exceeded your per-minute rate limit"}}',
    usage: ZERO_USAGE,
    timestamp: NOW - 2 * MIN,
    content: [],
  },
  {
    id: "u2",
    role: "user",
    content: [{ type: "text", text: "再在 design-lab 里加一个整页预览。" }],
    timestamp: NOW - 40_000,
  },
  {
    id: "a3",
    role: "assistant",
    model: GPT,
    status: "streaming",
    timestamp: NOW - 30_000,
    content: [
      { type: "thinking", thinking: "整页用吃 props 的叶子组件拼，数据走 fixture。" },
      ...calls(["t-live", "bash", { command: "pnpm test" }]),
    ],
  },
  tool("t-live", "bash", { command: "pnpm test" }, "", "running"),
]
export const PAGE_TIMINGS: TurnTiming[] = [
  { userId: "u1", startedAt: NOW - 9 * MIN, endedAt: NOW - 7 * MIN, outcome: "complete" },
  { userId: "u-long", startedAt: NOW - 3 * MIN, endedAt: NOW - 2 * MIN, outcome: "error" },
  { userId: "u2", startedAt: NOW - 40_000, outcome: "running" },
]
export const PAGE_CATALOG: ComposerVendor[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    models: [
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", thinkingLevels: ["low", "high"] },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    models: [{ id: "gpt-5", name: "GPT-5", thinkingLevels: ["low", "medium", "high"] }],
  },
]
export const PAGE_PRESET: ComposerPreset = { model: GPT, thinkingLevel: "medium" }
export const PAGE_USAGE: ContextUsageEstimate = {
  used: 84_000,
  window: 200_000,
  mcpToolCount: 6,
  segments: {
    systemPrompt: 6_000,
    memory: 2_000,
    skills: 3_000,
    tools: 12_000,
    mcpTools: 4_000,
    toolResults: 21_000,
    conversation: 36_000,
    other: 0,
    idle: 116_000,
  },
}
export const PAGE_TASKS: Task[] = [
  {
    id: "agent:review:1",
    kind: "agent",
    description: "审查改动",
    status: "running",
    prompt: "审查本次改动",
    steps: ["读取 diff", "检查 token"],
    tokens: 12_400,
    startedAt: NOW - 2 * MIN,
  },
  {
    id: "bash:dev",
    kind: "bash",
    description: "pnpm dev",
    status: "running",
    command: "pnpm dev",
    output: "ready in 820ms",
    startedAt: NOW - 8 * MIN,
  },
  {
    id: "bash:test",
    kind: "bash",
    description: "pnpm test",
    status: "failed",
    command: "pnpm test",
    output: "1 failed",
    exitCode: 1,
    error: "exit 1",
    startedAt: NOW - 6 * MIN,
    completedAt: NOW - 5 * MIN,
  },
]
export const PAGE_DIALOG: ExtensionUiDialog = {
  id: "page-select",
  method: "select",
  title: "部署到哪个环境？",
  options: ["staging", "production", "preview"],
}

export const PAGE_QUEUED_PROMPTS = [
  "检查待发队列拖拽排序和落位弹簧",
  "把侧栏置顶分组调成三条方便试拖",
  "跑完测试后截一张 compact 的图",
  "切到减弱动画模式确认只保留落点线",
]
