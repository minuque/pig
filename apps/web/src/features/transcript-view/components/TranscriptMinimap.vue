<template>
  <div
    class="timeline-minimap"
    :class="{ interactive: hitStripWidth > 0 }"
    data-testid="timeline-minimap"
    :style="{ width: hitAreaWidth, height: railHeight }"
  >
    <div
      ref="stage"
      class="minimap-stage"
      @focusout="onStageFocusOut"
      @keydown="onStageKeydown"
      @mouseleave="onStageMouseLeave"
    >
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            class="minimap-nav is-previous"
            type="button"
            :aria-label="t('transcript.minimapPrevious')"
            :disabled="!previousItem"
            @click="previousItem && emit('select', previousItem)"
          >
            <AltArrowUpIcon :size="12" />
          </button>
        </TooltipTrigger>

        <TooltipContent side="top">{{ t("transcript.minimapPrevious") }}</TooltipContent>
      </Tooltip>

      <button
        v-for="(item, index) in items"
        :key="item.id"
        class="minimap-tick"
        type="button"
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
      </button>

      <Tooltip>
        <TooltipTrigger as-child>
          <button
            class="minimap-nav is-next"
            type="button"
            :aria-label="t('transcript.minimapNext')"
            :disabled="!nextItem"
            @click="nextItem && emit('select', nextItem)"
          >
            <AltArrowDownIcon :size="12" />
          </button>
        </TooltipTrigger>

        <TooltipContent side="bottom">{{ t("transcript.minimapNext") }}</TooltipContent>
      </Tooltip>
    </div>

    <!-- 预览贴在悬停的刻度旁，位置交给浮层自己算 -->
    <Popover :open="hoverIndex !== null" @update:open="onPreviewOpenChange">
      <PopoverAnchor :reference="anchorEl" />

      <PopoverContent
        class="minimap-preview"
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
import { Popover, PopoverAnchor, PopoverContent } from "@components/ui/popover/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import type { TranscriptMinimapItem } from "@features/transcript-view/type.js"
import {
  MINIMAP_RAIL_PITCH,
  MINIMAP_RAIL_WIDTH,
  resolveMinimapHeightStyle,
  resolveMinimapTopPercent,
} from "@features/transcript-view/lib/transcript-minimap.js"
import { AltArrowDownIcon, AltArrowUpIcon } from "@components/icons/index.js"

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
const stage = useTemplateRef("stage")
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
/** 预览的锚点就是悬停的刻度，浮层据此自己定位。 */
const anchorEl = computed<HTMLElement | null>(() => {
  const index = hoverIndex.value

  if (index === null) return null
  return stage.value?.querySelectorAll<HTMLElement>(".minimap-tick")[index] ?? null
})
const hitAreaWidth = computed(() => (props.hitStripWidth > 0 ? `${MINIMAP_RAIL_WIDTH}px` : "0px"))
const railHeight = computed(() => resolveMinimapHeightStyle(props.items.length))

/** 刻度按钮的可访问名：回合序号 + 该回合提问摘要，无提问时用通用文案。 */
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

/** 鱼眼：悬停那条最长，越远越短；不悬停时全部收到最短档。 */
function stripScale(index: number): number {
  if (hoverIndex.value === null) return 0.333
  const distance = Math.abs(index - emphasizedIndex.value)

  if (distance === 0) return 1

  if (distance === 1) return 0.667

  if (distance === 2) return 0.417
  return 0.333
}

/** 上下键逐个回合走，Home/End 到两端；回车由按钮本身触发。 */
function onStageKeydown(event: KeyboardEvent) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return
  const ticks = [...(stage.value?.querySelectorAll<HTMLButtonElement>(".minimap-tick") ?? [])]

  if (!ticks.length) return
  const last = ticks.length - 1
  const at = ticks.indexOf(document.activeElement as HTMLButtonElement)
  let next: number

  if (event.key === "Home") next = 0
  else if (event.key === "End") next = last
  else if (at < 0) next = 0
  else next = Math.min(last, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1)))

  event.preventDefault()
  ticks[next]?.focus()
}

function onStageFocusOut(event: FocusEvent) {
  const root = event.currentTarget
  const next = event.relatedTarget

  if (root instanceof Node && next instanceof Node && root.contains(next)) return
  hoverIndex.value = null
}

/** 预览卡挂在 body 上，指针挪过去时 stage 先收到 mouseleave，这时别关。 */
function onStageMouseLeave(event: MouseEvent) {
  const next = event.relatedTarget

  if (next instanceof Element && next.closest('[data-slot="popover-content"]')) return
  hoverIndex.value = null
}

/** 从卡上回到导轨时交给刻度的 mouseenter 接着开，其余情况先关掉。 */
function onPreviewLeave(event: MouseEvent) {
  const next = event.relatedTarget

  if (next instanceof Node && stage.value?.contains(next)) return
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
  z-index: 3;
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
    background var(--duration-icon) var(--ease-smooth),
    scale var(--duration-icon) var(--ease-smooth);
}

/* 视口里的回合加深，正在看的那条最深 */
.minimap-strip.strip-in-view {
  background: var(--contrast-foreground-faint);
}

.minimap-strip.strip-active {
  background: var(--contrast-foreground);
}

/* 上一个 / 下一个回合：圆角方块贴着导轨两端，悬停导轨时露出 */
.minimap-nav {
  position: absolute;
  inset-inline-start: var(--space-xxs);
  z-index: 1;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--contrast-foreground-faint);
  cursor: pointer;
  translate: -50% 0;
  opacity: 0;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-hover),
    color var(--duration-fast) var(--ease-hover);
}

.minimap-stage:hover .minimap-nav,
.minimap-stage:focus-within .minimap-nav {
  opacity: 1;
}

.minimap-nav:hover:not(:disabled) {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.minimap-nav:disabled {
  opacity: 0.35;
  cursor: default;
}

.minimap-nav.is-previous {
  bottom: calc(100% + var(--space-xxs));
}

.minimap-nav.is-next {
  top: calc(100% + var(--space-xxs));
}

/* 面板的底色、圆角、阴影、内边距由 rt-PopoverContent 提供，这里只管排版 */
.preview-user {
  display: block;
  overflow: hidden;
  color: var(--contrast-foreground);
  font-size: var(--text-body);
  font-weight: var(--font-weight-normal);
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-assistant {
  display: -webkit-box;
  max-height: 3.75rem;
  margin-top: var(--space-xxs);
  overflow: hidden;
  color: var(--contrast-foreground-faint);
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
