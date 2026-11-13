import type { ProviderView } from "@/types/common-type.js"
import type { CustomModelDraft } from "@features/settings/lib/provider-view.js"
import type {
  AssistantRow,
  ThoughtStep,
  TimelineTurn,
  ToolCallView,
  ToolGroup,
  ToolRow,
  UserRow,
} from "@features/transcript-view/type.js"

/** 设计页的样例数据：形状与真实数据一致，只给演示用。 */
const NOW = Date.now()
export const PROSE = `## 改动摘要

把卡片外观收进 \`style/rt.css\`，**所有类卡片组件**共用一组变量：

- 外环用 \`--border\`，行间分隔用 \`--divider-top\`
- 圆角统一为 \`--radius-card\`
- [x] 设置页已切换
- [ ] DESIGN.md 待同步

> 卡片边框用内阴影画，非整数缩放下不会被取整成实线。

\`\`\`ts
export const card = { ring: "--border", radius: "--radius-card" }
\`\`\`

| 变量 | 用途 | 默认值 |
| --- | --- | --- |
| \`--border\` | 卡片外环 | gray-a6 |
| \`--border-soft\` | 行间分隔 | gray-a5 |
| \`--card-surface\` | 卡片底色 | transparent |

\`\`\`mermaid
flowchart LR
  tokens[tokens.css] --> rt[rt.css]
  rt --> card[Card]
  rt --> table[Table]
\`\`\`
`

function call(
  id: string,
  toolName: string,
  input: unknown,
  output: string,
  isError = false,
): ToolCallView {
  return {
    id,
    toolName,
    running: false,
    isError,
    input,
    outputText: output,
    outputImages: [],
    startedAt: NOW - 8000,
    endedAt: NOW - 6000,
  }
}

function group(id: string, key: ToolGroup["key"], items: ToolCallView[]): ToolGroup {
  return { type: "tools", id, key, items }
}

const THOUGHT: ThoughtStep = {
  type: "thought",
  id: "thought-1",
  text: "先读样式入口，确认卡片变量定义在哪一层，再改调用方。",
  streaming: false,
  startedAt: NOW - 12000,
  endedAt: NOW - 10000,
}
const STEPS: ToolRow["steps"] = [
  THOUGHT,
  group("g-read", "read", [
    call(
      "read-1",
      "read",
      { path: "apps/web/src/style/rt.css" },
      ".rt-Card {\n  --card-border-radius: var(--radius-card);\n}",
    ),
  ]),
  group("g-search", "search", [
    call(
      "grep-1",
      "grep",
      { pattern: "--radius-code", path: "apps/web/src" },
      "CodeCard.vue:14\nMarkdownTable.vue:53",
    ),
  ]),
  group("g-edit", "edit", [
    call(
      "edit-1",
      "edit",
      {
        path: "apps/web/src/style/tokens.css",
        oldText: "  --radius-card: calc(var(--radius) + 4px);\n  --radius-code: 0.65rem;",
        newText: "  --radius-card: 0.65rem;",
      },
      "Applied 1 edit",
    ),
  ]),
  group("g-command", "command", [
    call(
      "bash-1",
      "bash",
      { command: "pnpm check:touched" },
      "check passed\n\nCommand exited with code 0",
    ),
  ]),
  group("g-tool", "tool", [
    call(
      "mcp-1",
      "browser_screenshot",
      { url: "localhost:5555/design" },
      "connection refused",
      true,
    ),
  ]),
]

export function toolRow(mode: ToolRow["mode"] = "done"): ToolRow {
  const live = mode === "live"
  const steps = live
    ? STEPS.map((step, index) =>
        index === STEPS.length - 1 && step.type === "tools"
          ? {
              ...step,
              items: step.items.map((item) => ({
                ...item,
                running: true,
                isError: false,
                outputText: "",
              })),
            }
          : step,
      )
    : STEPS
  return {
    id: `tools-${mode}`,
    role: "tools",
    mode,
    turnStreaming: live,
    steps,
    aborted: false,
    error: false,
    startedAt: NOW - 12000,
    ...(live ? {} : { endedAt: NOW - 2000 }),
  }
}

export const USER_SHORT: UserRow = {
  id: "user-1",
  role: "user",
  text: "把所有类卡片组件的边框和圆角收敛到 Card 组件。",
  images: [],
  timestamp: NOW - 20000,
}
export const USER_LONG: UserRow = {
  ...USER_SHORT,
  id: "user-2",
  text: Array.from(
    { length: 14 },
    (_, index) => `${index + 1}. 第 ${index + 1} 条要求：保持外观一致，不另写一套样式。`,
  ).join("\n"),
}
export const ASSISTANT: AssistantRow = {
  id: "assistant-1",
  role: "assistant",
  text: PROSE,
  streaming: false,
  error: false,
  aborted: false,
  timestamp: NOW - 1000,
  showTimestamp: true,
}
export const TURN: TimelineTurn = {
  id: "turn-1",
  rows: [USER_SHORT, toolRow("done"), ASSISTANT],
}
export const PROVIDERS: ProviderView[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    kind: "builtin",
    capabilities: { apiKey: true, oauth: true, ambient: false },
    status: { configured: true, source: "stored", hint: null },
    models: [],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    kind: "builtin",
    capabilities: { apiKey: true, oauth: false, ambient: false },
    status: { configured: true, source: "environment", hint: "DEEPSEEK_API_KEY" },
    models: [],
  },
  {
    id: "openai",
    name: "OpenAI",
    kind: "builtin",
    capabilities: { apiKey: true, oauth: true, ambient: false },
    status: { configured: false, source: null, hint: null },
    models: [],
  },
  {
    id: "local-llm",
    name: "Local LLM",
    baseUrl: "http://127.0.0.1:11434/v1",
    kind: "custom",
    capabilities: { apiKey: true, oauth: false, ambient: false },
    status: { configured: true, source: "models_json_key", hint: null },
    models: [],
  },
]
export const CUSTOM_MODEL: CustomModelDraft = {
  id: "qwen3-coder",
  name: "Qwen3 Coder",
  contextWindow: "262144",
  maxTokens: "32768",
  reasoning: true,
  image: false,
}
