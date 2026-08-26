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
      class="flex h-[min(80vh,40rem)] w-[min(48rem,calc(100vw-2rem))] max-w-[min(48rem,calc(100vw-2rem))] flex-col gap-3 overflow-hidden sm:max-w-[min(48rem,calc(100vw-2rem))]"
      @open-auto-focus="onOpenAutoFocus"
    >
      <DialogTitle>{{ previewTitle }}</DialogTitle>
      <div ref="previewPane" class="preview-body" tabindex="-1">
        <div
          v-if="previewLoading"
          class="preview-status"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Spinner :size="24" aria-hidden="true" />
          <span class="sr-only">正在加载预览</span>
        </div>
        <div v-else-if="previewVirtual" class="preview-virtual" v-bind="containerProps">
          <div v-bind="wrapperProps">
            <pre v-for="item in list" :key="item.index" class="preview-line">{{ item.data }}</pre>
          </div>
        </div>
        <div v-else-if="previewBody" class="preview-markdown">
          <MarkdownRender v-bind="previewMarkdown" :content="previewBody" />
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script lang="ts">
export function contextPreviewPath(sessionId: string, segmentId: string): string {
  return `/api/v1/platform/context-usage?sessionId=${encodeURIComponent(sessionId)}&preview=${encodeURIComponent(segmentId)}`
}
</script>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import { useVirtualList } from "@vueuse/core"
import { X } from "lucide-vue-next"
import MarkdownRender from "markstream-vue"
import { platformRequest } from "@client/http.js"
import { Dialog, DialogContent, DialogTitle } from "@components/ui/dialog/index.js"
import { Spinner } from "@components/ui/spinner/index.js"
import {
  shouldVirtualizeMarkdown,
  splitLines,
} from "@features/transcript-view/lib/expandable-text.js"
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js"
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
const { isDark } = useColorScheme()
const previewOpen = ref(false)
const previewLoading = ref(false)
const previewTitle = ref("")
const previewBody = ref("")
const previewPane = ref<HTMLElement>()
let previewRequest = 0
const previewLines = computed(() => splitLines(previewBody.value))
const previewVirtual = computed(() => shouldVirtualizeMarkdown(previewBody.value))
const PREVIEW_LINE_PX = 21
const { list, containerProps, wrapperProps } = useVirtualList(previewLines, {
  itemHeight: PREVIEW_LINE_PX,
  overscan: 12,
})
const previewMarkdown = computed(
  () =>
    ({
      customId: "chat",
      mode: "minimal",
      renderCodeBlocksAsPre: true,
      fade: false,
      final: true,
      typewriter: false,
      smoothStreaming: false,
      isDark: isDark.value,
    }) as const,
)

async function openPreview(segment: ContextUsageSegment) {
  const sessionId = props.sessionId
  if (!sessionId) return
  const request = ++previewRequest
  previewTitle.value = segment.label
  previewBody.value = ""
  previewLoading.value = true
  previewOpen.value = true
  await nextTick()
  if (request !== previewRequest) return
  try {
    const result = await platformRequest<{
      preview: { title: string; content: string } | null
    }>(contextPreviewPath(sessionId, segment.id))
    if (request !== previewRequest) return
    previewTitle.value = result.preview?.title || segment.label
    previewBody.value = result.preview?.content || "没有可预览的内容。"
    await nextTick()
  } catch {
    if (request !== previewRequest) return
    previewBody.value = "无法加载预览。"
  } finally {
    if (request === previewRequest) previewLoading.value = false
  }
}

function closePreview() {
  previewRequest += 1
  previewOpen.value = false
  previewLoading.value = false
  previewBody.value = ""
}

function onPreviewOpen(open: boolean) {
  if (open) {
    previewOpen.value = true
    return
  }
  closePreview()
}

watch(() => props.sessionId, closePreview)

function onOpenAutoFocus(event: Event) {
  event.preventDefault()
  previewPane.value?.focus()
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
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  color: var(--ink);
  font-size: 15px;
  line-height: 1.7;
}
.preview-body:focus {
  outline: none;
}
.preview-status,
.preview-virtual,
.preview-markdown {
  min-height: 0;
  flex: 1;
}
.preview-status {
  display: grid;
  place-items: center;
}
.preview-virtual,
.preview-markdown {
  overflow: auto;
}
.preview-line {
  margin: 0;
  min-height: 21px;
  color: var(--ink-secondary);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 21px;
  white-space: pre;
  tab-size: 2;
}
</style>
