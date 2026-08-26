<template>
  <div class="call">
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
        <CircleCheck v-else :size="16" />
      </span>
      <span class="name">{{ item.toolName || "工具" }}</span>
      <span class="meta">
        <span v-if="summary" class="summary">{{ summary }}</span>
        <ChevronDown class="caret" :size="14" aria-hidden="true" />
      </span>
    </button>
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
import { ChevronDown, CircleCheck, LoaderCircle, X } from "lucide-vue-next"
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
.toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
  min-width: 0;
  min-height: 36px;
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
  color: var(--accent-green);
}
.status.is-err {
  background: var(--danger);
  color: var(--on-primary);
}
.status.is-run {
  color: var(--primary);
}
.spin {
  animation: tool-spin 0.8s linear infinite;
}
.name {
  flex: none;
  color: var(--ink-secondary);
  font-weight: var(--font-weight-medium);
}
.meta {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-width: 0;
}
.summary {
  min-width: 0;
  overflow: hidden;
  color: var(--ink-muted);
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.caret {
  flex: none;
  color: var(--ink-faint);
  transition: transform var(--duration-fast) var(--ease-smooth);
}
.toggle[aria-expanded="true"] .caret {
  transform: rotate(180deg);
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
  .caret {
    transition: none;
  }
}
</style>
