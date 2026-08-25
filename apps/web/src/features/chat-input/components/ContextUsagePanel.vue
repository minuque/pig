<template>
  <div class="glass-shell usage-shell">
    <div class="glass-host usage-host">
      <div class="head">
        <h3 class="title">上下文占用</h3>
        <button type="button" class="close" aria-label="关闭上下文占用" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>
      <div class="stats">
        <span class="percent">{{ usage.percent }}% 已用</span>
        <span class="tokens">{{ tokenSummary }}</span>
      </div>
      <div class="bar" role="img" :aria-label="tokenSummary">
        <span
          v-for="segment in usage.segments"
          :key="segment.id"
          class="bar-seg"
          :style="{
            width: `${segmentShare(segment.tokens, usage.window)}%`,
            background: segment.color,
          }"
        ></span>
      </div>
      <ul v-if="usage.segments.length" class="legend">
        <li v-for="segment in usage.segments" :key="segment.id">
          <button
            v-if="sessionId && segment.previewable"
            type="button"
            class="legend-row legend-row--button"
            @click="openPreview(segment)"
          >
            <span class="swatch" :style="{ background: segment.color }"></span>
            <span class="legend-label">{{ segment.label }}</span>
            <span class="legend-count">{{ formatTokenCount(segment.tokens) }}</span>
            <span class="legend-pct"
              >{{ segmentShare(segment.tokens, usage.window).toFixed(1) }}%</span
            >
          </button>
          <div v-else class="legend-row">
            <span class="swatch" :style="{ background: segment.color }"></span>
            <span class="legend-label">{{ segment.label }}</span>
            <span class="legend-count">{{ formatTokenCount(segment.tokens) }}</span>
            <span class="legend-pct"
              >{{ segmentShare(segment.tokens, usage.window).toFixed(1) }}%</span
            >
          </div>
        </li>
      </ul>
    </div>
  </div>
  <Dialog :open="previewOpen" @update:open="onPreviewOpen">
    <DialogContent
      class="flex max-h-[80vh] w-full max-w-[min(48rem,calc(100vw-2rem))] flex-col gap-3 overflow-hidden sm:max-w-[min(48rem,calc(100vw-2rem))]"
    >
      <DialogTitle>{{ previewTitle }}</DialogTitle>
      <pre class="preview-body">{{ previewBody }}</pre>
    </DialogContent>
  </Dialog>
</template>

<script lang="ts">
export function contextPreviewPath(sessionId: string, segmentId: string): string {
  return `/api/v1/platform/context-usage?sessionId=${encodeURIComponent(sessionId)}&preview=${encodeURIComponent(segmentId)}`
}
</script>

<script setup lang="ts">
import { computed, ref } from "vue"
import { X } from "lucide-vue-next"
import { platformRequest } from "@client/http.js"
import { Dialog, DialogContent, DialogTitle } from "@components/ui/dialog/index.js"
import {
  contextUsageSummary,
  formatTokenCount,
  segmentShare,
  type ContextUsage,
  type ContextUsageSegment,
} from "@features/chat-input/lib/context-usage.js"

const props = defineProps<{
  usage: ContextUsage
  sessionId?: string | undefined
}>()

const emit = defineEmits<{
  close: []
}>()

const tokenSummary = computed(() => contextUsageSummary(props.usage))
const previewOpen = ref(false)
const previewTitle = ref("")
const previewBody = ref("")
let previewRequest = 0

async function openPreview(segment: ContextUsageSegment) {
  const sessionId = props.sessionId
  if (!sessionId) return
  const request = ++previewRequest
  previewTitle.value = segment.label
  previewBody.value = "加载中…"
  previewOpen.value = true
  try {
    const result = await platformRequest<{
      preview: { title: string; content: string } | null
    }>(contextPreviewPath(sessionId, segment.id))
    if (request !== previewRequest) return
    previewTitle.value = result.preview?.title || segment.label
    previewBody.value = result.preview?.content || "没有可预览的内容。"
  } catch {
    if (request !== previewRequest) return
    previewBody.value = "无法加载预览。"
  }
}

function onPreviewOpen(open: boolean) {
  previewOpen.value = open
  if (!open) previewRequest += 1
}
</script>

<style scoped>
.usage-shell {
  position: absolute;
  inset-inline: 0;
  bottom: calc(100% + 8px);
  z-index: 10;
}
.usage-host {
  position: relative;
  padding: 12px 14px 10px;
  background: var(--composer);
  border: var(--border-width) solid var(--composer-ring);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-soft);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xs);
}
.title {
  margin: 0;
  color: var(--ink);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-caption--line-height);
}
.close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 24px;
  height: 24px;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--ink-faint);
  cursor: pointer;
}
.close:hover {
  color: var(--ink);
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}
.stats {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--spacing-xs);
  margin-top: 6px;
}
.percent {
  color: var(--ink-secondary);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}
.tokens {
  color: var(--ink-faint);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}
.bar {
  display: flex;
  overflow: hidden;
  height: 6px;
  margin-top: 10px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--ink) 12%, transparent);
}
.bar-seg {
  display: block;
  flex: none;
  height: 100%;
  min-width: 0;
}
.legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0 2px;
  padding: 0;
  list-style: none;
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 18px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-secondary);
  font: inherit;
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  text-align: start;
}
.legend-row--button {
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.legend-row--button:hover {
  color: var(--ink);
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}
.swatch {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.legend-label {
  min-width: 0;
  flex: 1;
}
.legend-count,
.legend-pct {
  flex: none;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}
.legend-pct {
  min-width: 3.5em;
  text-align: end;
}
.preview-body {
  margin: 0;
  overflow: auto;
  max-height: calc(80vh - 5rem);
  color: var(--ink-secondary);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
