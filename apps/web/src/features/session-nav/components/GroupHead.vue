<template>
  <div
    class="group-head"
    :draggable="sortable"
    @pointerdown="pointerFocus = true"
    @click="emit('toggle')"
    @dragstart="onDragStart"
    @mouseleave="onHeadLeave"
  >
    <button class="group-toggle" type="button" :aria-expanded="!collapsed">
      <span class="mark" :class="{ 'is-grip': sortable }">
        <Folder v-if="collapsed" class="size-icon folder-icon" />
        <FolderOpen v-else class="size-icon folder-icon" />
        <GripVertical v-if="sortable" class="size-icon grip-icon" />
      </span>

      <span class="group-name">{{ name }}</span>
    </button>

    <span class="trail">
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            class="group-new hover-only"
            type="button"
            :aria-label="t('session.newSessionInDir')"
            draggable="false"
            @click.stop="emit('create')"
            @dragstart.stop.prevent
          >
            <MessageCirclePlus class="size-icon" />
          </button>
        </TooltipTrigger>

        <TooltipContent>{{ t("session.newSession") }}</TooltipContent>
      </Tooltip>
    </span>
  </div>
</template>

<script setup lang="ts">
import { shallowRef } from "vue"
import { Folder, FolderOpen, GripVertical, MessageCirclePlus } from "@lucide/vue"
import { useI18n } from "@i18n/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"

const { t } = useI18n()
const props = withDefaults(
  defineProps<{
    name: string
    collapsed?: boolean
    sortable?: boolean
  }>(),
  { sortable: false },
)
const emit = defineEmits<{
  toggle: []
  create: []
  dragstart: [event: DragEvent]
}>()
const pointerFocus = shallowRef(false)

function onHeadLeave(event: MouseEvent) {
  const head = event.currentTarget
  const active = document.activeElement
  const fromPointer = pointerFocus.value
  pointerFocus.value = false

  if (!fromPointer || !(head instanceof HTMLElement) || !(active instanceof HTMLElement)) return

  if (head.contains(active)) active.blur()
}

function onDragStart(event: DragEvent) {
  if (!props.sortable) {
    event.preventDefault()
    return
  }

  const head = event.currentTarget

  if (head instanceof HTMLElement && event.dataTransfer) {
    const rect = head.getBoundingClientRect()
    event.dataTransfer.setDragImage(head, event.clientX - rect.left, event.clientY - rect.top)
  }

  emit("dragstart", event)
}
</script>

<style scoped>
.group-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  height: var(--size-nav-rail);
  padding-inline: var(--spacing-xs);
  border-radius: var(--radius-md);
  line-height: 0;
}

.group-head:hover {
  background: var(--interaction-hover);
}

.group-toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  flex: 1;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  line-height: 0;
  text-align: start;
}

.mark {
  flex: none;
  display: grid;
  place-items: center;
  width: var(--size-icon);
  height: var(--size-icon);
  color: var(--ink-faint);
  transition: color var(--duration-fast) var(--ease-smooth);
}

.mark.is-grip .folder-icon,
.mark.is-grip .grip-icon {
  grid-area: 1 / 1;
}

.grip-icon {
  display: none;
  color: var(--primary);
}

.group-head:hover .mark {
  color: var(--ink-muted);
}

.group-head:hover .group-name {
  color: var(--ink);
}

.group-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--ink-muted);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-caption--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--duration-fast) var(--ease-smooth);
}

.trail {
  position: absolute;
  inset-inline-end: var(--spacing-xs);
  display: flex;
  align-items: center;
  align-self: center;
}

.group-new {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--icon-button-pad);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-muted);
  line-height: 0;
}

.group-new:hover,
.group-new:focus-visible {
  background: var(--hover-quiet);
  color: var(--ink);
}

@media (hover: hover) {
  .group-head:hover .mark.is-grip .folder-icon {
    display: none;
  }

  .group-head:hover .mark.is-grip .grip-icon {
    display: block;
  }

  .trail {
    pointer-events: none;
  }

  .group-new.hover-only {
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--duration-fast) var(--ease-out);
  }

  .group-head:hover .group-new.hover-only,
  .group-head:has(:focus-visible) .group-new.hover-only,
  .group-new.hover-only:focus-visible {
    opacity: 1;
    pointer-events: auto;
  }

  .group-head:hover .trail,
  .group-head:has(:focus-visible) .trail {
    pointer-events: auto;
  }
}
</style>
