import { computed, ref, shallowRef } from "vue"

import type { ContextUsageEstimate } from "@/types/context-usage-type.js"
import type {
  ComposerAttachment,
  ComposerAttachmentsApi,
} from "@features/composer/hooks/use-composer-attachments.js"
import type { ComposerQueueApi, QueuedPrompt } from "@features/composer/hooks/use-composer-queue.js"
import { projectContextUsage } from "@features/composer/lib/context-usage.js"
import { vendorDisplayName } from "@features/composer/lib/vendor-logo.js"
import type { ComposerModelInfo, ComposerVendor, ContextUsage } from "@features/composer/type.js"

/** 品牌显示名走同一份表，故事里的供应商名与真实目录一致。 */
function vendor(id: string, models: ComposerModelInfo[]): ComposerVendor {
  return { id, name: vendorDisplayName(id), models }
}

/** 两个供应商、每家有思考档位与上下文窗口，模型弹层的强度脚注与防溢出都有档可切。 */
export const COMPOSER_CATALOG: ComposerVendor[] = [
  vendor("anthropic", [
    {
      id: "claude-sonnet-4-5",
      name: "Claude Sonnet 4.5",
      thinkingLevels: ["off", "low", "medium", "high"],
      contextWindow: 200_000,
    },
    {
      id: "claude-opus-4-1",
      name: "Claude Opus 4.1",
      thinkingLevels: ["off", "medium", "high", "max"],
      contextWindow: 200_000,
    },
    {
      id: "claude-haiku-4-5",
      name: "Claude Haiku 4.5",
      thinkingLevels: ["off", "low"],
      contextWindow: 200_000,
    },
  ]),
  vendor("openai", [
    {
      id: "gpt-5",
      name: "GPT-5",
      thinkingLevels: ["off", "minimal", "low", "medium", "high"],
      contextWindow: 400_000,
    },
    {
      id: "gpt-5-mini",
      name: "GPT-5 mini",
      thinkingLevels: ["off", "minimal", "low"],
      contextWindow: 400_000,
    },
  ]),
]
/** 队列面板预置的两条待发：一条长到会被省略号截断。 */
export const COMPOSER_QUEUE_SEED: readonly string[] = [
  "把日期桶的时间基准改成当天零点，再跑一遍单测确认没被改坏。",
  "把这轮改动的结论整理成一张表，我要贴到 PR 里。",
]
const USAGE_ESTIMATE: ContextUsageEstimate = {
  used: 63_400,
  window: 200_000,
  segments: {
    systemPrompt: 4_200,
    memory: 1_100,
    skills: 2_600,
    tools: 8_900,
    toolResults: 14_300,
    conversation: 31_900,
    other: 400,
    idle: 0,
  },
}
/** 上下文环与用量面板：投影走真实 lib，文案与分档配色不另写一份。 */
export const COMPOSER_USAGE: ContextUsage = projectContextUsage(USAGE_ESTIMATE) ?? {
  used: 0,
  window: 0,
  percent: 0,
  segments: [],
}

/** 内存附件：只有移除有真实行为，发送一律留空，故事不发请求。 */
export function createComposerAttachments(): ComposerAttachmentsApi {
  const files = ref<ComposerAttachment[]>([])
  const progress = ref<ReadonlyMap<string, number>>(new Map())
  const error = ref("")
  return {
    files,
    progress,
    error,
    addFiles: () => undefined,
    addDropped: () => undefined,
    remove(id) {
      files.value = files.value.filter((item) => item.id !== id)
    },
    consumeForSend: () => undefined,
    settle: () => undefined,
    setKey: () => undefined,
  }
}

/** 内存队列：整页故事只有一个会话，不按 sessionId 分桶。 */
export function createComposerQueue(): ComposerQueueApi {
  const list = shallowRef<QueuedPrompt[]>([])
  let seq = 0
  return {
    items: computed(() => list.value),
    enqueue(text, attachments) {
      const trimmed = text.trim()

      if (!trimmed) return
      seq += 1
      list.value = [...list.value, { id: `queued-${seq}`, text: trimmed, attachments }]
    },
    remove(id) {
      list.value = list.value.filter((item) => item.id !== id)
    },
    reorder(id, toIndex) {
      const index = list.value.findIndex((item) => item.id === id)
      const item = list.value[index]

      if (!item) return
      const rest = list.value.filter((row) => row.id !== id)

      rest.splice(Math.max(0, Math.min(rest.length, toIndex)), 0, item)
      list.value = rest
    },
    shift() {
      const [head, ...rest] = list.value

      list.value = rest
      return head
    },
    shiftFor: () => undefined,
    unshiftFor: (_sessionId, item) => {
      list.value = [item, ...list.value]
    },
    sizeFor: () => list.value.length,
    setKey: () => undefined,
  }
}
