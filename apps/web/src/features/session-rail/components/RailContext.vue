<template>
  <div class="ctx">
    <div class="ctx-head">
      <span>{{ contextUsageSummary(usage) }}</span>
      <span class="ctx-percent">{{ usage.percent }}%</span>
    </div>

    <!-- 分类堆叠的用量条：每段一个分类，底槽是剩余空间 -->
    <div
      class="ctx-meter"
      role="meter"
      :aria-valuenow="usage.percent"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="t('rail.context')"
    >
      <i
        v-for="segment in used"
        :key="segment.id"
        :style="{
          inlineSize: `${segmentShare(segment.tokens, usage.window)}%`,
          background: segment.color,
        }"
      />
    </div>

    <ul class="ctx-legend">
      <li v-for="segment in rows" :key="segment.id">
        <component
          :is="canPreview(segment) ? 'button' : 'div'"
          :type="canPreview(segment) ? 'button' : undefined"
          class="ctx-row"
          :data-idle="segment.id === 'idle' || undefined"
          @click="canPreview(segment) && openPreview(segment)"
        >
          <span class="ctx-swatch" :style="{ background: segment.color }" />
          <span class="ctx-label">{{ segment.label }}</span>
          <span class="ctx-tokens">{{ formatTokenCount(segment.tokens) }}</span>
          <span class="ctx-share">{{ share(segment) }}</span>
        </component>
      </li>
    </ul>

    <Dialog :open="previewOpen" @update:open="(open) => !open && closePreview()">
      <DialogContent class="ctx-preview" @open-auto-focus="onOpenAutoFocus">
        <DialogTitle>{{ previewTitle }}</DialogTitle>

        <div ref="previewPane" class="ctx-preview-body" tabindex="-1">
          <div v-if="previewLoading" class="ctx-preview-status">
            <Spinner :size="24" />
          </div>

          <pre v-else class="ctx-preview-text">{{ previewBody }}</pre>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { contextPreview } from "@client/platform.js"
import { Dialog, DialogContent, DialogTitle } from "@components/ui/dialog/index.js"
import { Spinner } from "@components/ui/spinner/index.js"
import {
  contextUsageSummary,
  formatTokenCount,
  segmentShare,
} from "@features/composer/lib/context-usage.js"
import type { ContextUsage, ContextUsageSegment } from "@features/composer/type.js"

const props = defineProps<{ usage: ContextUsage; sessionId: string | undefined }>()
const { t } = useI18n()
/** 已占用的分类按 token 从多到少排；剩余空间单列在最后。 */
const used = computed(() =>
  props.usage.segments
    .filter((segment) => segment.id !== "idle" && segment.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens),
)
const rows = computed(() => [
  ...used.value,
  ...props.usage.segments.filter((segment) => segment.id === "idle" && segment.tokens > 0),
])
const share = (segment: ContextUsageSegment) =>
  props.usage.window > 0 ? `${segmentShare(segment.tokens, props.usage.window).toFixed(1)}%` : "—"
const canPreview = (segment: ContextUsageSegment) => Boolean(props.sessionId && segment.previewable)
const previewOpen = ref(false)
const previewLoading = ref(false)
const previewTitle = ref("")
const previewBody = ref("")
const previewPane = useTemplateRef("previewPane")
let previewRequest = 0

/** 点分类打开模态框，取这一类实际进上下文的内容；连点只认最后一次。 */
async function openPreview(segment: ContextUsageSegment) {
  const sessionId = props.sessionId

  if (!sessionId) return
  const request = ++previewRequest
  previewTitle.value = segment.label
  previewBody.value = ""
  previewLoading.value = true
  previewOpen.value = true

  try {
    const preview = await contextPreview(sessionId, segment.id)

    if (request !== previewRequest) return
    previewTitle.value = preview?.title || segment.label
    previewBody.value = preview?.content || t("rail.previewEmpty")
  } catch {
    if (request === previewRequest) previewBody.value = t("rail.previewFailed")
  } finally {
    if (request === previewRequest) previewLoading.value = false
  }

  await nextTick()
}

function closePreview() {
  previewRequest += 1
  previewOpen.value = false
  previewLoading.value = false
  previewBody.value = ""
}

watch(() => props.sessionId, closePreview)

function onOpenAutoFocus(event: Event) {
  event.preventDefault()
  previewPane.value?.focus()
}
</script>

<style scoped>
.ctx {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.ctx-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-xs);
  color: var(--contrast-foreground-secondary);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.ctx-percent {
  color: var(--contrast-foreground);
}

.ctx-meter {
  display: flex;
  gap: 1px;
  block-size: var(--size-meter-block);
  overflow: hidden;
  background: var(--fill-strong);
  border-radius: var(--radius-pill);
}

.ctx-meter i {
  flex: none;
}

.ctx-legend {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* 一行：色块 · 分类名 · token 数 · 占比 */
.ctx-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  inline-size: 100%;
  min-block-size: var(--size-icon);
  padding: 0 var(--space-xxs);
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--contrast-foreground-faint);
  font: inherit;
  font-size: var(--text-meta);
  text-align: start;
}

button.ctx-row {
  cursor: pointer;
}

button.ctx-row:hover {
  background: var(--btn-hover);
  color: var(--contrast-foreground);
}

.ctx-swatch {
  flex: none;
  inline-size: var(--size-legend-swatch);
  block-size: var(--size-legend-swatch);
  border-radius: calc(var(--radius-control) / 3);
}

.ctx-label {
  flex: 1;
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ctx-tokens {
  flex: none;
  font-variant-numeric: tabular-nums;
}

.ctx-share {
  flex: none;
  min-inline-size: var(--size-legend-share);
  /* 占比是这一行的主数据，用一级文本色 */
  color: var(--contrast-foreground);
  font-variant-numeric: tabular-nums;
  text-align: end;
  white-space: nowrap;
}
</style>

<style>
/* 预览模态框经 Portal 挂到 body，scoped 打不中：占视口七成，内容区自己滚；
   标题与正文的间距只取标题自带的下边距，不再叠一层 gap */
.ctx-preview.rt-DialogContent {
  display: flex;
  flex-direction: column;
  inline-size: 70vw;
  max-inline-size: 70vw;
  block-size: 70vh;
  overflow: hidden;
}

.ctx-preview-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-block-size: 0;
}

.ctx-preview-body:focus {
  outline: none;
}

.ctx-preview-status {
  display: grid;
  flex: 1;
  place-items: center;
}

.ctx-preview-text {
  flex: 1;
  min-block-size: 0;
  margin: 0;
  overflow: auto;
  color: var(--contrast-foreground);
  font: inherit;
  font-size: var(--text-body);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
