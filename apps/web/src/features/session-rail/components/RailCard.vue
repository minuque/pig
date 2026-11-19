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

              <ChevronRightIcon
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
import { ChevronRightIcon, GripVerticalIcon } from "@components/icons/index.js"
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
  border-radius: var(--radius-card);
  background: var(--bg-surface);
  box-shadow: 0 0 0 1px var(--border);
}

/* 拖着走的卡片压在上层，铺浮层底遮住下面的卡；位移由 useDragReorder 驱动 */
.rail-card.is-drag-live {
  z-index: 2;
  background: var(--bg-raised);
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
  gap: var(--space-2xs);
  min-inline-size: 0;
  min-block-size: var(--control-sm);
  padding-inline: var(--space-2xs);
  color: var(--fg);
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
  inline-size: var(--icon-sm);
  block-size: var(--icon-sm);
  color: var(--fg-secondary);
}

/* 收起时的摘要居右，和把手占同一个位置：把手露出时摘要让开 */
.rail-summary {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2xs);
  min-inline-size: 0;
  margin-inline-start: var(--space-xs);
  overflow: hidden;
  color: var(--fg-secondary);
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  transition: opacity var(--duration-fast) var(--ease-out);
}

/* 展开时摘要让给正文 */
.rail-summary[aria-hidden="true"] {
  opacity: 0;
}

.rail-card:hover .rail-summary,
.rail-card:has(:focus-visible) .rail-summary,
.rail-card.is-drag-live .rail-summary {
  opacity: 0;
}

/* 整张卡都能拖；把手只在悬停或键盘聚焦时露出（鼠标按下留下的焦点不算），浮在行尾不占位 */
.rail-grip {
  position: absolute;
  inset-block: 0;
  inset-inline-end: 0;
  opacity: 0;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  inline-size: var(--control-sm);
  color: var(--fg-secondary);
  border-radius: var(--radius-control);
  cursor: grab;
  touch-action: none;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
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

  .rail-summary {
    opacity: 0;
  }
}

.rail-grip:hover {
  color: var(--fg);
}

.rail-grip:active {
  cursor: grabbing;
}

.rail-grip :deep(svg) {
  inline-size: var(--icon-md);
  block-size: var(--icon-md);
}

.rail-body {
  padding: var(--space-2xs) var(--space-2xs) 0;
}
</style>
