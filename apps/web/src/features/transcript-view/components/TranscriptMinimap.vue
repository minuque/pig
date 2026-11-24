<template>
  <div
    class="timeline-minimap"
    :class="{ interactive: hitStripWidth > 0 }"
    data-testid="timeline-minimap"
    :style="{ width: hitAreaWidth, height: railHeight }"
  >
    <Toolbar
      ref="stage"
      orientation="vertical"
      class="minimap-stage"
      :aria-label="t('transcript.minimapLabel')"
      @focusout="onStageFocusOut"
      @mouseleave="onStageMouseLeave"
    >
      <Tooltip>
        <TooltipTrigger>
          <template #render="{ props: part }">
            <ToolbarButton
              v-bind="part"
              class="minimap-nav is-previous"
              :aria-label="t('transcript.minimapPrevious')"
              :disabled="!previousItem"
              @click="previousItem && emit('select', previousItem)"
            >
              <ChevronUpIcon class="size-icon-sm" />
            </ToolbarButton>
          </template>
        </TooltipTrigger>

        <TooltipContent side="top">{{ t("transcript.minimapPrevious") }}</TooltipContent>
      </Tooltip>

      <ToolbarButton
        v-for="(item, index) in items"
        :key="item.id"
        class="minimap-tick"
        :aria-label="tickLabel(index, item)"
        :style="tickStyle(index)"
        @mouseenter="hoverIndex = index"
        @focus="hoverIndex = index"
        @click="emit('select', item)"
      >
        <span
          class="minimap-strip"
          :class="{
            'strip-active': emphasizedIndex === index,
            'strip-in-view': inView.has(item.id),
          }"
          :style="{ scale: `${stripScale(index)} 1` }"
        ></span>
      </ToolbarButton>

      <Tooltip>
        <TooltipTrigger>
          <template #render="{ props: part }">
            <ToolbarButton
              v-bind="part"
              class="minimap-nav is-next"
              :aria-label="t('transcript.minimapNext')"
              :disabled="!nextItem"
              @click="nextItem && emit('select', nextItem)"
            >
              <ChevronDownIcon class="size-icon-sm" />
            </ToolbarButton>
          </template>
        </TooltipTrigger>

        <TooltipContent side="bottom">{{ t("transcript.minimapNext") }}</TooltipContent>
      </Tooltip>
    </Toolbar>

    <Popover :open="hoverIndex !== null" @update:open="onPreviewOpenChange">
      <PopoverContent
        class="minimap-preview"
        :anchor="anchorEl"
        initial-focus="none"
        style="width: 20rem"
        side="right"
        align="center"
        size="s"
        @mouseleave="onPreviewLeave"
      >
        <span v-if="hoverItem" class="preview-user">
          {{ hoverItem.userText ?? t("transcript.userMessage") }}
        </span>

        <span v-if="hoverItem?.assistantText" class="preview-assistant">
          {{ hoverItem.assistantText }}
        </span>
      </PopoverContent>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { Popover, PopoverContent } from "@pig/ui/popover"
import { Toolbar, ToolbarButton } from "@pig/ui/toolbar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import type { TranscriptMinimapItem } from "@features/transcript-view/type.js"
import {
  MINIMAP_RAIL_PITCH,
  MINIMAP_RAIL_WIDTH,
  resolveMinimapHeightStyle,
  resolveMinimapTopPercent,
} from "@features/transcript-view/lib/transcript-minimap.js"
import { ChevronDownIcon, ChevronUpIcon } from "@components/icons/index.js"

const props = defineProps<{
  items: readonly TranscriptMinimapItem[]
  inViewIds: readonly string[]
  currentId: string | null
  hitStripWidth: number
}>()
const emit = defineEmits<{
  select: [item: TranscriptMinimapItem]
}>()
const { t } = useI18n()
const stage = useTemplateRef<{ $el: HTMLElement }>("stage")
const hoverIndex = shallowRef<number | null>(null)
const pinnedIndex = shallowRef(0)
const inView = computed(() => new Set(props.inViewIds))

watch(
  () => [props.currentId, props.items] as const,
  ([id, items]) => {
    const index = id ? items.findIndex((item) => item.id === id) : -1

    if (index >= 0) {
      pinnedIndex.value = index
      return
    }

    if (pinnedIndex.value >= items.length) pinnedIndex.value = Math.max(0, items.length - 1)
  },
  { immediate: true },
)

const lastIndex = computed(() => Math.max(0, props.items.length - 1))
const emphasizedIndex = computed(() => {
  const hover = hoverIndex.value

  if (hover !== null && hover <= lastIndex.value) return hover
  return Math.min(pinnedIndex.value, lastIndex.value)
})
const hoverItem = computed(() => {
  const index = hoverIndex.value
  return index === null ? null : (props.items[index] ?? null)
})
const previousItem = computed(() => props.items[pinnedIndex.value - 1] ?? null)
const nextItem = computed(() => props.items[pinnedIndex.value + 1] ?? null)
const anchorEl = computed<HTMLElement | null>(() => {
  const index = hoverIndex.value

  if (index === null) return null
  return stage.value?.$el.querySelectorAll<HTMLElement>(".minimap-tick")[index] ?? null
})
const hitAreaWidth = computed(() => (props.hitStripWidth > 0 ? `${MINIMAP_RAIL_WIDTH}px` : "0px"))
const railHeight = computed(() => resolveMinimapHeightStyle(props.items.length))

function tickLabel(index: number, item: TranscriptMinimapItem): string {
  return t("transcript.minimapTick", {
    index: index + 1,
    text: item.userText ?? t("transcript.userMessage"),
  })
}

function tickStyle(index: number): { top: string; height: string } {
  return {
    top: `${resolveMinimapTopPercent(index, props.items.length)}%`,
    height: `${MINIMAP_RAIL_PITCH}px`,
  }
}

function stripScale(index: number): number {
  if (hoverIndex.value === null) return 0.333
  const distance = Math.abs(index - emphasizedIndex.value)

  if (distance === 0) return 1

  if (distance === 1) return 0.667

  if (distance === 2) return 0.417
  return 0.333
}

function onStageFocusOut(event: FocusEvent) {
  const root = event.currentTarget
  const next = event.relatedTarget

  if (root instanceof Node && next instanceof Node && root.contains(next)) return
  hoverIndex.value = null
}

function onStageMouseLeave(event: MouseEvent) {
  const next = event.relatedTarget

  if (next instanceof Element && next.closest('[data-slot="popover-content"]')) return
  hoverIndex.value = null
}

function onPreviewLeave(event: MouseEvent) {
  const next = event.relatedTarget

  if (next instanceof Node && stage.value?.$el.contains(next)) return
  hoverIndex.value = null
}

function onPreviewOpenChange(open: boolean) {
  if (!open) hoverIndex.value = null
}
</script>

<style scoped>
.timeline-minimap {
  pointer-events: none;
  position: absolute;
  top: calc((100% - var(--composer-reserve, 0px)) / 2);
  inset-inline-start: var(--space-md);
  z-index: var(--z-overlay);
  display: none;
  width: 44px;
  transform: translateY(-50%);
}

.timeline-minimap.interactive {
  pointer-events: auto;
}

.minimap-stage {
  position: relative;
  width: 100%;
  height: 100%;
  user-select: none;
}

.minimap-tick {
  position: absolute;
  inset-inline-start: 0;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  translate: 0 -50%;
}

.minimap-tick:focus-visible {
  outline: none;
}

.minimap-tick:focus-visible .minimap-strip {
  box-shadow: var(--focus-ring);
}

.minimap-strip {
  pointer-events: none;
  position: absolute;
  inset-inline-start: 0;
  top: 50%;
  width: 24px;
  height: 2px;
  border-radius: var(--radius-pill);
  background: var(--minimap-marker);
  transform-origin: left center;
  translate: 0 -50%;
  transition:
    background var(--duration-slow) var(--ease-out),
    scale var(--duration-slow) var(--ease-out);
}

.minimap-strip.strip-in-view {
  background: var(--fg-secondary);
}

.minimap-strip.strip-active {
  background: var(--fg);
}

.minimap-nav {
  position: absolute;
  inset-inline-start: var(--space-2xs);
  z-index: var(--z-raise);
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: calc(var(--radius-control) / 2);
  background: transparent;
  color: var(--fg-secondary);
  cursor: pointer;
  translate: -50% 0;
  opacity: 0;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.minimap-stage:hover .minimap-nav,
.minimap-stage:focus-within .minimap-nav {
  opacity: 1;
}

.minimap-nav:hover:not([data-disabled]) {
  background: var(--bg-hover);
  color: var(--fg);
}

.minimap-nav[data-disabled] {
  opacity: var(--opacity-disabled);
  cursor: default;
}

.minimap-nav.is-previous {
  bottom: calc(100% + var(--space-2xs));
}

.minimap-nav.is-next {
  top: calc(100% + var(--space-2xs));
}

.preview-user {
  display: block;
  overflow: hidden;
  color: var(--fg);
  font-size: var(--text-body);
  font-weight: var(--font-weight-normal);
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-assistant {
  display: -webkit-box;
  max-height: 3.75rem;
  margin-top: var(--space-2xs);
  overflow: hidden;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: 20px;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

@media (pointer: fine) {
  .timeline-minimap {
    display: block;
  }
}

@media (prefers-reduced-motion: reduce) {
  .minimap-strip,
  .minimap-nav {
    transition: none;
  }
}
</style>
