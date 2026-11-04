<template>
  <div v-if="single" class="tool-run is-single">
    <ToolRow
      :call="single"
      :open="expandedTools.get(single.id) ?? false"
      @toggle="emit('toggleTool', single.id, $event)"
    />
  </div>

  <div v-else class="tool-run">
    <button
      type="button"
      class="tool-run-summary"
      :aria-expanded="open"
      @click="emit('toggleExpand', !open)"
    >
      <span ref="stack" class="tool-run-label-stack" :class="{ 'is-gliding': gliding }">
        <TransitionGroup name="label-roll" tag="span" class="tool-run-label-slots">
          <span
            v-for="slot in slots"
            :key="slot.id"
            :data-slot="slot.id"
            class="tool-run-label"
            :class="{ shimmer: slot.live }"
            :data-text="slot.live ? slot.text : undefined"
          >
            {{ slot.text }}
          </span>
        </TransitionGroup>
      </span>

      <span v-if="summary.lineChange.added || summary.lineChange.removed" class="tool-run-counts">
        <span v-if="summary.lineChange.added" class="added">+{{ summary.lineChange.added }}</span>

        <span v-if="summary.lineChange.removed" class="removed">
          -{{ summary.lineChange.removed }}
        </span>
      </span>

      <AltArrowRightIcon class="tool-run-caret" :class="{ 'is-open': open }" data-icon="inline" />
    </button>

    <ToolRunCard
      v-if="open"
      :calls="calls"
      :expanded-tools="expandedTools"
      @toggle-tool="(id, value) => emit('toggleTool', id, value)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { AltArrowRightIcon } from "@components/icons/index.js"
import ToolRow from "@features/transcript-view/components/tool/ToolRow.vue"
import ToolRunCard from "@features/transcript-view/components/tool/ToolRunCard.vue"
import {
  runningToolLabel,
  toolCalls,
  toolRunSummary,
} from "@features/transcript-view/lib/tool-run.js"
import type { ToolRow as ToolRowModel } from "@features/transcript-view/type.js"

const HOLD_MS = 650
const ROLL_MS = 180
const props = defineProps<{
  row: ToolRowModel
  expanded: boolean | undefined
  expandedTools: Map<string, boolean>
}>()
const emit = defineEmits<{
  toggleExpand: [open: boolean]
  toggleTool: [id: string, open: boolean]
}>()
const { t } = useI18n()
const calls = computed(() => toolCalls(props.row))
const single = computed(() => (calls.value.length === 1 ? calls.value[0] : undefined))
const open = computed(() => props.expanded ?? false)
const summary = computed(() => toolRunSummary(props.row))
const settledLabel = computed(() => {
  const parts = summary.value.parts.map((part) =>
    part.kind === "text" ? part.text : `${part.prefix} ${part.count} ${part.suffix}`,
  )

  if (summary.value.failCount)
    parts.push(`${t("transcript.statusError")} ${summary.value.failCount}`)
  return parts.join(", ")
})
const live = computed(() => runningToolLabel(props.row))
const displayLive = ref<string | null>(live.value)
let holdTimer: ReturnType<typeof setTimeout> | undefined

watch(
  live,
  (next) => {
    if (holdTimer) {
      clearTimeout(holdTimer)
      holdTimer = undefined
    }

    if (next) {
      displayLive.value = next
      return
    }

    if (!displayLive.value) return
    holdTimer = setTimeout(() => {
      holdTimer = undefined
      displayLive.value = null
    }, HOLD_MS)
  },
  { flush: "sync" },
)

const labelText = computed(() => displayLive.value ?? settledLabel.value)
const labelLive = computed(() => displayLive.value !== null)

type LabelSlot = { id: number; text: string; live: boolean }

let slotId = 0
const slots = shallowRef<LabelSlot[]>([
  { id: slotId, text: labelText.value, live: labelLive.value },
])
const stack = useTemplateRef<HTMLElement>("stack")
const gliding = ref(false)
let glide: Animation | null = null

/** 换字时宽度从旧值滑到新值，避免尾部箭头跟着瞬间跳位；对齐 cc-wrapper 的 MorphSlots。 */
watch([labelText, labelLive], async ([text, live]) => {
  const node = stack.value
  const from = node?.getBoundingClientRect().width ?? 0
  const slot = { id: ++slotId, text, live }
  slots.value = [slot]
  glide?.cancel()
  glide = null
  gliding.value = false

  if (!node || from === 0 || prefersReducedMotion()) return
  await nextTick()
  const target = node.querySelector<HTMLElement>(`[data-slot="${slot.id}"]`)
  const width = target?.getBoundingClientRect().width ?? 0

  if (!width || Math.abs(width - from) < 0.5) return
  gliding.value = true
  glide = node.animate([{ width: `${from}px` }, { width: `${width}px` }], {
    duration: ROLL_MS,
    easing: "cubic-bezier(0.2, 0, 0, 1)",
  })
  glide.onfinish = () => {
    glide = null
    gliding.value = false
  }
})

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

onBeforeUnmount(() => {
  if (holdTimer) clearTimeout(holdTimer)
  glide?.cancel()
})
</script>

<style scoped>
.tool-run {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tool-run-summary {
  display: flex;
  align-self: flex-start;
  align-items: center;
  gap: var(--space-xxs);
  max-width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--contrast-foreground-muted);
  font: inherit;
  font-size: var(--text-body-md);
  line-height: var(--text-body-md--line-height);
  text-align: start;
  cursor: pointer;
}

.tool-run-summary:hover,
.tool-run-summary:focus-visible,
.tool-run-summary[aria-expanded="true"] {
  color: var(--contrast-foreground-secondary);
}

.tool-run-label-stack {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  overflow: clip;
}

.tool-run-label-slots {
  display: inline-grid;
  align-items: center;
  justify-items: start;
  min-width: 0;
}

.tool-run-label {
  grid-area: 1 / 1;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-run-label-stack.is-gliding .tool-run-label {
  max-width: none;
}

.tool-run-counts {
  display: flex;
  flex: none;
  gap: var(--space-xxs);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.added {
  padding: 0 var(--space-xxs);
  border-radius: var(--radius-xs);
  background: var(--success-bg);
  color: var(--success);
}

.removed {
  padding: 0 var(--space-xxs);
  border-radius: var(--radius-xs);
  background: var(--danger-bg);
  color: var(--danger);
}

.tool-run-caret {
  flex: none;
  width: var(--size-icon);
  height: var(--size-icon);
  transition: transform var(--duration-fast) var(--ease-out);
}

.tool-run-caret.is-open {
  transform: rotate(90deg);
}

@media (prefers-reduced-motion: reduce) {
  .tool-run-caret {
    transition: none;
  }
}
</style>
