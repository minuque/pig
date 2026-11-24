<template>
  <Collapsible v-if="row.steps.length" :open="open" @update:open="emit('toggleExpand', $event)">
    <template #render="{ props: part }">
      <div v-bind="part" class="tool-run">
        <div class="tool-run-head">
          <CollapsibleTrigger>
            <template #render="{ props: part }">
              <button v-bind="part" type="button" class="tool-run-summary">
                <RollText :text="labelText" :live="labelLive" />
                <span v-if="duration" class="tool-run-time">{{ duration }}</span>

                <span
                  v-if="summary.lineChange.added || summary.lineChange.removed"
                  class="tool-run-counts"
                >
                  <span v-if="summary.lineChange.added" class="added">
                    +{{ summary.lineChange.added }}
                  </span>

                  <span v-if="summary.lineChange.removed" class="removed">
                    -{{ summary.lineChange.removed }}
                  </span>
                </span>
              </button>
            </template>
          </CollapsibleTrigger>

          <ChevronRightIcon
            class="tool-run-caret"
            :class="{ 'is-open': open }"
            data-icon="inline"
          />

          <ToolThumbs class="tool-run-thumbs" :images="images" />
        </div>

        <CollapsibleContent class="tool-run-body">
          <ToolRunCard
            :row="row"
            :expanded-tools="expandedTools"
            @toggle-tool="(id, value) => emit('toggleTool', id, value)"
          />
        </CollapsibleContent>
      </div>
    </template>
  </Collapsible>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue"
import { useIntervalFn } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { ChevronRightIcon } from "@components/icons/index.js"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@pig/ui/collapsible"
import { RollText } from "@pig/ui/roll-text"
import ToolRunCard from "@features/transcript-view/components/tool/ToolRunCard.vue"
import ToolThumbs from "@features/transcript-view/components/tool/ToolThumbs.vue"
import {
  runningToolLabel,
  toolRunImages,
  toolRunSummary,
} from "@features/transcript-view/lib/tool-run.js"
import type { ToolRow as ToolRowModel } from "@features/transcript-view/type.js"
import { formatElapsed } from "@utils/time.js"

const HOLD_MS = 650
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
const ticking = computed(() => props.row.mode === "live" && props.row.turnStreaming)
const now = shallowRef(Date.now())
const clock = useIntervalFn(
  () => {
    now.value = Date.now()
  },
  1000,
  { immediate: false },
)

watch(
  ticking,
  (on) => {
    now.value = Date.now()

    if (on) clock.resume()
    else clock.pause()
  },
  { immediate: true },
)

const duration = computed(() => {
  const { startedAt, endedAt } = props.row

  if (startedAt === undefined) return ""

  if (ticking.value)
    return formatElapsed(Math.max(now.value, endedAt ?? 0) - startedAt, { showMs: false })

  if (endedAt === undefined) return ""
  return formatElapsed(endedAt - startedAt)
})
const images = computed(() => toolRunImages(props.row))
const open = computed(() => props.expanded ?? false)
const summary = computed(() => toolRunSummary(props.row))
const settledLabel = computed(() => {
  const parts = summary.value.parts.map((part) =>
    part.kind === "text" ? part.text : `${part.prefix} ${part.count} ${part.suffix}`,
  )
  const label = parts.join(", ")
  const failed = summary.value.failCount
  return failed ? `${label}${t("transcript.failedCount", { count: failed })}` : label
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

onBeforeUnmount(() => {
  if (holdTimer) clearTimeout(holdTimer)
})
</script>

<style scoped>
.tool-run {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tool-run-body {
  min-width: 0;
}

.tool-run-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  max-width: 100%;
  min-width: 0;
  color: var(--fg-secondary);
}

.tool-run-summary {
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  gap: var(--space-2xs);
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--fg-secondary);
  font: inherit;
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  text-align: start;
  cursor: pointer;
}

.tool-run-summary::after {
  content: "";
  position: absolute;
  inset: 0;
}

.tool-run-summary:is(:focus-visible, [aria-expanded="true"]),
.tool-run-head:has(.tool-run-summary:is(:focus-visible, [aria-expanded="true"])) .tool-run-caret {
  color: var(--fg);
}

@media (hover: hover) {
  .tool-run-summary:hover,
  .tool-run-head:has(.tool-run-summary:hover) .tool-run-caret {
    color: var(--fg);
  }
}

.tool-run-thumbs {
  margin-inline-start: auto;
  padding-inline-start: var(--space-xs);
}

.tool-run-counts {
  display: flex;
  flex: none;
  gap: var(--space-2xs);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.tool-run-time {
  flex: none;
  color: var(--fg-secondary);
  font-variant-numeric: tabular-nums;
}

.added {
  padding: 0 var(--space-2xs);
  border-radius: calc(var(--radius-control) / 2);
  background: var(--success-subtle);
  color: var(--success-text);
}

.removed {
  padding: 0 var(--space-2xs);
  border-radius: calc(var(--radius-control) / 2);
  background: var(--danger-subtle);
  color: var(--danger-text);
}

.tool-run-caret {
  flex: none;
  width: var(--icon-sm);
  height: var(--icon-sm);
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
