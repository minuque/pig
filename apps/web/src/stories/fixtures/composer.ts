import { computed, ref, shallowRef } from "vue"

import type { ContextUsageEstimate } from "@/types/context-usage-type.js"
import type {
  ComposerAttachment,
  ComposerAttachmentsApi,
} from "@features/composer/hooks/use-composer-attachments.js"
import type { ComposerQueueApi, QueuedPrompt } from "@features/composer/hooks/use-composer-queue.js"
import { t } from "@i18n/index.js"
import { MAX_COMPOSER_ATTACHMENTS } from "@features/composer/hooks/use-composer-attachments.js"
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
/** 模拟上传的节奏：约 1s 涨满，只为让进度环有东西可画。 */
const SIM_STEP_MS = 50
const SIM_TOTAL_MS = 1000

/** 去重键：同名同大小同类型视为同一个文件。 */
function attachmentKey(file: File): string {
  return `${file.name}\0${file.size}\0${file.type}`
}

/** 内存附件：真读入 File，按 ComposerAttachment 结构造条目；上传与发送只留本地模拟。 */
export function createComposerAttachments(): ComposerAttachmentsApi {
  const files = ref<ComposerAttachment[]>([])
  const progress = ref<ReadonlyMap<string, number>>(new Map())
  const error = ref("")
  const timers = new Map<string, ReturnType<typeof setInterval>>()

  function write(id: string, value: number | undefined): void {
    const next = new Map(progress.value)

    if (value === undefined) next.delete(id)
    else next.set(id, value)
    progress.value = next
  }

  /** 停掉进度：计时器与进度键一起清，环随之消失。 */
  function stop(id: string): void {
    const timer = timers.get(id)

    if (timer !== undefined) globalThis.clearInterval(timer)
    timers.delete(id)
    write(id, undefined)
  }

  function release(item: ComposerAttachment): void {
    if (item.url) URL.revokeObjectURL(item.url)
  }

  /** 逐个涨到 100：落地即删键，与真实 hook 的可见节奏一致。 */
  function simulate(item: ComposerAttachment): void {
    let shown = 0
    const step = 100 / (SIM_TOTAL_MS / SIM_STEP_MS)

    write(item.id, 0)
    timers.set(
      item.id,
      globalThis.setInterval(() => {
        shown = Math.min(100, shown + step)

        if (shown < 100) return write(item.id, Math.round(shown))
        stop(item.id)
      }, SIM_STEP_MS),
    )
  }

  function apply(input: FileList | File[] | null | undefined): void {
    const current = files.value
    const keys = new Set(current.map((item) => attachmentKey(item.file)))
    const added: ComposerAttachment[] = []
    let full = false

    for (const file of input ? Array.from(input) : []) {
      const key = attachmentKey(file)

      if (keys.has(key)) continue

      if (current.length + added.length >= MAX_COMPOSER_ATTACHMENTS) {
        full = true
        continue
      }

      keys.add(key)
      const mimeType = file.type || "application/octet-stream"

      added.push({
        id: crypto.randomUUID(),
        name: file.name || "attachment",
        mimeType,
        size: file.size,
        // 图片给 blob 预览，其余只渲染文件卡片
        url: mimeType.startsWith("image/") ? URL.createObjectURL(file) : "",
        file,
      })
    }

    if (added.length) {
      files.value = [...current, ...added]
      added.forEach(simulate)
    }

    error.value = full ? t("composer.maxAttachments", { count: MAX_COMPOSER_ATTACHMENTS }) : ""
  }

  return {
    files,
    progress,
    error,
    addFiles: apply,
    addDropped(data) {
      if (!data) return
      const dropped: File[] = []

      for (const item of Array.from(data.items)) {
        if (item.kind !== "file") continue
        const file = item.getAsFile()

        if (file) dropped.push(file)
      }

      apply(dropped.length ? dropped : data.files)
    },
    remove(id) {
      stop(id)
      const target = files.value.find((item) => item.id === id)

      if (target) release(target)
      files.value = files.value.filter((item) => item.id !== id)
    },
    consumeForSend() {
      if (!files.value.length) return undefined
      files.value.forEach((item) => stop(item.id))
      return {
        batch: crypto.randomUUID(),
        files: [...files.value],
        reportProgress: write,
      }
    },
    settle(batch) {
      const sent = new Set(batch.files.map((item) => item.id))

      batch.files.forEach((item) => {
        stop(item.id)
        release(item)
      })
      files.value = files.value.filter((item) => !sent.has(item.id))
      error.value = ""
    },
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
