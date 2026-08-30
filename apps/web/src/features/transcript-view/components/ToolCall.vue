<template>
  <div class="call">
    <button
      type="button"
      class="toggle"
      :aria-expanded="open"
      :aria-label="toggleLabel"
      :disabled="!expandable"
      @click="onToggle"
    >
      <span class="spine" :class="statusKind" aria-hidden="true">
        <LoaderCircle class="spin" :size="16" :data-visible="running" />
        <X :size="10" :stroke-width="3" :data-visible="!running && item.isError" />
        <component :is="kindIcon" :size="16" :data-visible="!running && !item.isError" />
      </span>
      <span class="kind">{{ kind }}</span>
      <span v-if="object" class="pill" :class="{ 'is-cmd': isCommand, 'is-file': isFile }">
        <File v-if="isFile" class="pill-icon" :size="12" aria-hidden="true" />
        <span class="pill-text">{{ object }}</span>
      </span>
      <span v-if="summary" class="summary">{{ summary }}</span>
      <ChevronRight v-if="expandable" class="caret" :size="14" aria-hidden="true" />
    </button>
    <div v-if="open && expandable" class="body">
      <div v-if="isCommand" class="well">
        <p v-if="command" class="well-cmd">{{ command }}</p>
        <div v-if="outputText || outputImages.length" class="well-out">
          <ExpandableText v-if="outputText" :text="outputText" embedded />
          <div v-if="outputImages.length" class="images">
            <TranscriptImage
              v-for="(image, index) in outputImages"
              :key="index"
              :data="image.data"
              :mime-type="image.mimeType"
            />
          </div>
        </div>
      </div>
      <div v-else class="well">
        <section v-if="inputFull" class="layer">
          <h3 class="label">入参</h3>
          <ExpandableText :text="inputFull" embedded />
        </section>
        <section v-if="outputText || outputImages.length" class="layer">
          <h3 class="label">输出</h3>
          <ExpandableText v-if="outputText" :text="outputText" embedded />
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
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from "vue"
import {
  ChevronRight,
  File,
  FileText,
  LoaderCircle,
  Pencil,
  Search,
  SquareTerminal,
  Wrench,
  X,
} from "lucide-vue-next"
import ExpandableText from "@features/transcript-view/components/ExpandableText.vue"
import TranscriptImage from "@features/transcript-view/components/TranscriptImage.vue"
import {
  toolCallDetail,
  toolCallKindLabel,
  toolCallSummary,
  toolCallTitle,
  toolInputHint,
  toolInputPretty,
} from "@features/transcript-view/lib/transcript-format.js"
import type { ToolCallView } from "@features/transcript-view/lib/transcript-rows.js"

const props = defineProps<{
  item: ToolCallView
}>()

const open = defineModel<boolean>("open", { required: true })
const running = computed(() => props.item.running)
const toolName = computed(() => props.item.toolName.trim().toLowerCase())
const isCommand = computed(() => toolName.value === "bash")
const isFile = computed(() => {
  const name = toolName.value
  return name === "read" || name === "write" || name === "edit"
})
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
const kind = computed(() => toolCallKindLabel(props.item.toolName))
const detail = computed(() => toolCallDetail(props.item.toolName, props.item.input))
const object = computed(() => {
  if (!isCommand.value) return detail.value
  const hint = toolInputHint(props.item.input)
  return hint || detail.value.replace(/^"|"$/g, "")
})
const command = computed(() => (isCommand.value ? toolInputHint(props.item.input) : ""))
const title = computed(() => toolCallTitle(props.item.toolName, props.item.input))
const summary = computed(() => toolCallSummary(props.item))
const kindIcon = computed((): Component => {
  switch (toolName.value) {
    case "edit":
    case "write":
      return Pencil
    case "read":
      return FileText
    case "bash":
      return SquareTerminal
    case "grep":
    case "find":
      return Search
    default:
      return Wrench
  }
})
const toggleLabel = computed(() => {
  const lead = `${title.value}，${statusLabel.value}`
  return summary.value ? `${lead}，${summary.value}` : lead
})
const inputFull = computed(() => (open.value ? toolInputPretty(props.item.input) : ""))
const outputText = computed(() => (open.value ? props.item.outputText : ""))
const outputImages = computed(() => (open.value ? props.item.outputImages : []))
const expandable = computed(() => {
  if (isCommand.value) return command.value.length > 0 || props.item.outputText.length > 0
  return (
    toolInputPretty(props.item.input).length > 0 ||
    props.item.outputText.length > 0 ||
    props.item.outputImages.length > 0
  )
})

function onToggle() {
  if (!expandable.value) return
  open.value = !open.value
}
</script>

<style scoped>
.call {
  contain: layout style;
  min-width: 0;
}
.toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: fit-content;
  max-width: 100%;
  min-width: 0;
  min-height: 22px;
  padding: 2px 0;
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
.toggle:disabled {
  cursor: default;
  opacity: 1;
}
.toggle:not(:disabled):active {
  transform: none;
}
.toggle:focus {
  outline: none;
}
.toggle:focus-visible {
  outline: var(--focus-ring-width) solid var(--primary);
  outline-offset: var(--focus-ring-width);
}
.spine {
  flex: none;
  display: inline-grid;
  place-items: center;
  width: 16px;
  height: 16px;
}
.spine.is-ok {
  color: var(--ink-faint);
}
.spine.is-err {
  color: var(--danger);
}
.spine.is-run {
  color: var(--primary);
}
.spine > :deep(*) {
  grid-area: 1 / 1;
  transition:
    opacity 300ms cubic-bezier(0.2, 0, 0, 1),
    scale 300ms cubic-bezier(0.2, 0, 0, 1),
    filter 300ms cubic-bezier(0.2, 0, 0, 1);
}
.spine > :deep([data-visible="false"]) {
  opacity: 0;
  scale: 0.25;
  filter: blur(4px);
}
.spin {
  animation: tool-spin 0.8s linear infinite;
}
.kind {
  flex: none;
  color: var(--ink-muted);
  font-weight: var(--font-weight-regular);
}
.toggle:hover .kind,
.toggle[aria-expanded="true"] .kind {
  color: var(--ink-secondary);
}
.pill {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 28rem;
  padding: 1px 8px 1px 6px;
  overflow: hidden;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-full);
  background: var(--canvas-soft);
  color: var(--ink);
}
.pill.is-cmd {
  padding-inline: 8px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-caption-mono);
  letter-spacing: 0;
}
.pill-icon {
  flex: none;
  color: var(--ink-faint);
}
.pill-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.summary {
  flex: none;
  min-width: 0;
  overflow: hidden;
  color: var(--ink-muted);
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.caret {
  flex: none;
  color: var(--ink-faint);
  opacity: 0;
  transition:
    transform var(--duration-fast) var(--ease-smooth),
    opacity var(--duration-fast) var(--ease-smooth);
}
.toggle:hover .caret,
.toggle[aria-expanded="true"] .caret {
  opacity: 1;
}
.toggle[aria-expanded="true"] .caret {
  transform: rotate(90deg);
}
.body {
  min-width: 0;
  margin-top: 4px;
  margin-inline-start: 24px;
}
.well {
  overflow: hidden;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-lg);
  background: var(--canvas-soft);
}
.well-cmd {
  margin: 0;
  padding: var(--spacing-sm);
  color: var(--ink-secondary);
  font-family: var(--font-mono);
  font-size: var(--text-caption-mono);
  letter-spacing: 0;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.well-out {
  padding: var(--spacing-sm);
  background: var(--accent-midnight);
  color: var(--on-primary);
}
.layer {
  min-width: 0;
  padding: var(--spacing-sm);
}
.layer + .layer {
  border-top: var(--border-width) solid var(--hairline);
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
  .spine > :deep(*) {
    transition: none;
  }
  .caret {
    transition: none;
  }
}
</style>
