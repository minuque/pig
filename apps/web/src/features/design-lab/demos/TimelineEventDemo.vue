<template>
  <Story title="会话事件">
    <Variant title="分隔线">
      <div class="demo-stack">
        <TimelineEvent
          v-for="row in events"
          :key="row.id"
          :row="row"
          :open="open.has(row.id)"
          @toggle="toggle(row.id, $event)"
        />
      </div>
    </Variant>

    <Variant title="告警与扩展消息">
      <div class="demo-stack">
        <TimelineAlert
          v-for="row in alerts"
          :key="row.id"
          :row="row"
          :open="open.has(row.id)"
          @toggle="toggle(row.id, $event)"
        />

        <ExtensionMessage
          :row="extension"
          :open="open.has(extension.id)"
          @toggle="toggle(extension.id, $event)"
        />
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { reactive } from "vue"
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import ExtensionMessage from "@features/transcript-view/components/events/ExtensionMessage.vue"
import TimelineAlert from "@features/transcript-view/components/events/TimelineAlert.vue"
import TimelineEvent from "@features/transcript-view/components/events/TimelineEvent.vue"
import type { AlertRow, EventRow, ExtensionRow } from "@features/transcript-view/type.js"

const open = reactive(new Set<string>())
const events: EventRow[] = [
  {
    id: "switch",
    role: "event",
    timestamp: 0,
    parts: [
      {
        kind: "model",
        from: { model: { provider: "anthropic", id: "claude-sonnet-4-5" }, thinkingLevel: "high" },
        to: { model: { provider: "openai", id: "gpt-5" }, thinkingLevel: "low" },
      },
      {
        kind: "compaction",
        tokensBefore: 128_400,
        summary: "- 目标：重构会话通知\n- 进度：gateway 已投影",
      },
    ],
  },
  {
    id: "retry",
    role: "event",
    timestamp: 0,
    parts: [
      {
        kind: "retry_recovered",
        attempts: [
          { timestamp: 0, errorMessage: "overloaded_error: Overloaded" },
          { timestamp: 0, errorMessage: "api_error: Internal server error" },
        ],
      },
    ],
  },
  { id: "aborted", role: "event", timestamp: 0, parts: [{ kind: "aborted" }] },
  {
    id: "failed",
    role: "event",
    timestamp: 0,
    parts: [{ kind: "compaction_failed", errorMessage: "摘要模型 60s 内无响应" }],
  },
]
const alerts: AlertRow[] = [
  {
    id: "request",
    role: "alert",
    source: "request",
    level: "error",
    retries: 3,
    timestamp: 0,
    message:
      '429 {"type":"error","error":{"type":"rate_limit_error","message":"Number of request tokens has exceeded your per-minute rate limit"}}',
  },
  {
    id: "warning",
    role: "alert",
    source: "extension",
    level: "warning",
    retries: 0,
    timestamp: 0,
    message: "3 个文件未通过格式检查，已跳过自动提交",
  },
]
const extension: ExtensionRow = {
  id: "extension",
  role: "extension",
  customType: "review-bot",
  text: "发现 2 处可能的空指针：\n\n- `transcript.ts:118` 未判空\n- `TurnRow.vue:92` 可能是 undefined",
  images: [],
  timestamp: 0,
}

function toggle(id: string, value: boolean) {
  if (value) open.add(id)
  else open.delete(id)
}
</script>

<style scoped>
.demo-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  inline-size: min(100%, 720px);
}
</style>
