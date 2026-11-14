<template>
  <CollapsibleRoot
    as="section"
    class="rail-card"
    :open="open"
    :data-id="id"
    :aria-labelledby="titleId"
  >
    <ContextMenu>
      <ContextMenuTrigger as-child>
        <div class="rail-top">
          <h3 :id="titleId" class="rail-heading">
            <button
              type="button"
              class="rail-head"
              :aria-expanded="open"
              :aria-controls="bodyId"
              @click="$event.altKey ? emit('toggleAll') : emit('toggle')"
            >
              <span class="rail-title">{{ title }}</span>

              <AltArrowRightIcon
                class="rail-caret motion-turn"
                :class="{ 'is-on': open }"
                aria-hidden="true"
              />

              <span v-if="$slots.summary" class="rail-summary" :aria-hidden="open || undefined">
                <slot name="summary" />
              </span>
            </button>
          </h3>

          <span
            class="rail-grip"
            role="button"
            tabindex="0"
            :aria-label="t('rail.reorder', { name: title })"
            @keydown.up.prevent="emit('nudge', -1)"
            @keydown.down.prevent="emit('nudge', 1)"
          >
            <GripVerticalIcon aria-hidden="true" />
          </span>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent size="s">
        <slot name="menu" />
      </ContextMenuContent>
    </ContextMenu>

    <CollapsibleContent :id="bodyId" class="rail-body">
      <slot />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>

<script setup lang="ts">
import { useId } from "vue"
import { CollapsibleContent, CollapsibleRoot } from "reka-ui"
import { useI18n } from "@i18n/index.js"
import { AltArrowRightIcon, GripVerticalIcon } from "@components/icons/index.js"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@components/ui/context-menu/index.js"

defineProps<{ id: string; title: string; open: boolean }>()

const emit = defineEmits<{ toggle: []; toggleAll: []; nudge: [step: number] }>()
const { t } = useI18n()
const titleId = useId()
const bodyId = useId()
</script>

<style scoped>
.rail-card {
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
  padding: var(--space-xs);
  background: var(--surface);
  border-radius: var(--radius-card);
  box-shadow: 0 0 0 1px var(--border-soft);
}

/* 拖着走的卡片浮起来；位移由 useDragReorder 驱动 */
.rail-card.is-drag-live {
  z-index: 2;
  box-shadow: var(--shadow-popover);
  cursor: grabbing;
  user-select: none;
}

.rail-top {
  position: relative;
  display: flex;
  align-items: center;
  min-inline-size: 0;
}

.rail-heading {
  display: flex;
  flex: 1;
  min-inline-size: 0;
  margin: 0;
}

.rail-head {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-xxs);
  min-inline-size: 0;
  min-block-size: var(--size-rail-row);
  padding-inline: var(--space-xxs);
  color: var(--contrast-foreground);
  font: inherit;
  font-size: var(--text-meta);
  font-weight: 500;
  text-align: start;
  background: none;
  border: 0;
  border-radius: var(--radius-control);
  cursor: pointer;
}

.rail-head:focus-visible,
.rail-grip:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.rail-title {
  flex-shrink: 0;
}

.rail-caret {
  flex-shrink: 0;
  inline-size: var(--size-icon-xs);
  block-size: var(--size-icon-xs);
  color: var(--contrast-foreground-faint);
}

.rail-summary {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-xxs);
  min-inline-size: 0;
  margin-inline-start: auto;
  overflow: hidden;
  color: var(--contrast-foreground-faint);
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  transition: opacity var(--duration-fast) var(--ease-out);
}

/* 展开时摘要让给正文 */
.rail-summary[aria-hidden="true"] {
  opacity: 0;
}

/* 整张卡都能拖；把手只在悬停或键盘聚焦时露出（鼠标按下留下的焦点不算），位置照留 */
.rail-grip {
  opacity: 0;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  inline-size: var(--size-rail-row);
  block-size: var(--size-rail-row);
  color: var(--contrast-foreground-faint);
  border-radius: var(--radius-control);
  cursor: grab;
  touch-action: none;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out);
}

.rail-card:hover .rail-grip,
.rail-card:has(:focus-visible) .rail-grip,
.rail-card.is-drag-live .rail-grip {
  opacity: 1;
}

@media (hover: none) {
  .rail-grip {
    opacity: 1;
  }
}

.rail-grip:hover {
  color: var(--contrast-foreground);
  background: var(--btn-hover);
}

.rail-grip:active {
  cursor: grabbing;
}

.rail-grip :deep(svg) {
  inline-size: var(--size-icon);
  block-size: var(--size-icon);
}

.rail-body {
  padding: var(--space-xxs) var(--space-xxs) 0;
}
</style>
