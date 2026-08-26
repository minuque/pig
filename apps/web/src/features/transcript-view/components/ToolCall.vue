<template>
  <div class="call">
    <div class="bar">
      <button
        type="button"
        class="toggle"
        :aria-expanded="open"
        :aria-label="toggleLabel"
        @click="open = !open"
      >
        <span class="status" :class="statusKind" aria-hidden="true">
          <LoaderCircle v-if="running" class="spin" :size="16" />
          <X v-else-if="item.isError" :size="10" :stroke-width="3" />
          <Check v-else :size="10" :stroke-width="3" />
        </span>
        <span class="name">{{ item.toolName || "工具" }}</span>
        <span v-if="summary" class="summary">{{ summary }}</span>
        <ChevronDown class="caret" :size="14" aria-hidden="true" />
      </button>
      <button type="button" class="copy" aria-label="复制" @click="copyPayload">
        <Copy :size="14" />
      </button>
    </div>
    <div v-if="open" class="body">
      <section v-if="inputFull" class="layer">
        <h3 class="label">入参</h3>
        <ExpandableText :text="inputFull" />
      </section>
      <section v-if="outputText || outputImages.length" class="layer">
        <h3 class="label">输出</h3>
        <ExpandableText v-if="outputText" :text="outputText" />
        <div v-if="outputImages.length" class="images">
          <TranscriptImage
            v-for="(image, index) in outputImages"
            :key="index"
            :data="image.data"
            :mime-type="image.mimeType"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { Check, ChevronDown, Copy, LoaderCircle, X } from "lucide-vue-next"
import type { ToolTranscriptItem } from "@earendil-works/pi-protocol"
import ExpandableText from "@features/transcript-view/components/ExpandableText.vue"
import TranscriptImage from "@features/transcript-view/components/TranscriptImage.vue"
import {
  toolCallSummary,
  toolInputPretty,
  transcriptImages,
  transcriptText,
} from "@features/transcript-view/lib/transcript-format.js"

const props = defineProps<{
  item: ToolTranscriptItem
}>()

const open = shallowRef(false)
const running = computed(() => props.item.status === "running")
const statusKind = computed(() => {
  if (props.item.isError) return "is-err"
  if (running.value) return "is-run"
  return "is-ok"
})
const statusLabel = computed(() => {
  if (props.item.isError) return "失败"
  if (running.value) return "运行中"
  return "完成"
})
const summary = computed(() => toolCallSummary(props.item))
const toggleLabel = computed(() => {
  const name = props.item.toolName || "工具"
  return summary.value
    ? `${name}，${statusLabel.value}，${summary.value}`
    : `${name}，${statusLabel.value}`
})
const inputFull = computed(() => (open.value ? toolInputPretty(props.item.input) : ""))
const outputText = computed(() => (open.value ? transcriptText(props.item) : ""))
const outputImages = computed(() => (open.value ? transcriptImages(props.item) : []))

watch(
  () => props.item.isError,
  (isError) => {
    if (isError) open.value = true
  },
)

async function copyPayload() {
  const chunks = [toolInputPretty(props.item.input), transcriptText(props.item)].filter(
    (chunk) => chunk.trim().length > 0,
  )
  if (chunks.length === 0) return
  try {
    await navigator.clipboard.writeText(chunks.join("\n\n"))
  } catch {
    // 剪贴板不可用时保持静默
  }
}
</script>

<style scoped>
.call {
  contain: layout style;
  margin: 0 0 var(--spacing-xs);
  overflow: hidden;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-lg);
  background: var(--canvas-soft);
}
.bar {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 36px;
}
.toggle {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  min-height: 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-caption);
  font-weight: inherit;
  text-align: left;
}
.toggle:hover {
  color: var(--ink);
}
.toggle:not(:disabled):active {
  transform: none;
}
.status {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: var(--radius-full);
}
.status.is-ok {
  background: var(--accent-green);
  color: var(--on-primary);
}
.status.is-err {
  background: var(--danger);
  color: var(--on-primary);
}
.status.is-run {
  color: var(--ink-muted);
}
.spin {
  animation: tool-spin 0.8s linear infinite;
}
.name {
  flex: none;
  color: var(--ink-secondary);
  font-weight: var(--font-weight-medium);
}
.summary {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--ink-muted);
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.caret {
  flex: none;
  margin-inline-start: auto;
  color: var(--ink-faint);
  transition: transform var(--duration-fast) var(--ease-smooth);
}
.toggle[aria-expanded="true"] .caret {
  transform: rotate(180deg);
}
.copy {
  position: absolute;
  inset-inline-end: 34px;
  top: 4px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  opacity: 0;
  pointer-events: none;
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth);
}
.call:hover .copy,
.call:focus-within .copy {
  opacity: 1;
  pointer-events: auto;
}
.copy:hover {
  color: var(--ink);
}
.body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border-top: var(--border-width) solid var(--hairline);
}
.layer {
  min-width: 0;
}
.label {
  margin: 0 0 var(--spacing-xxs);
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--tracking-eyebrow);
}
.images {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-xs);
}
@keyframes tool-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .spin {
    animation: none;
  }
  .caret,
  .copy {
    transition: none;
  }
}
</style>
