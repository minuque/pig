<template>
  <div class="row" role="listitem" :data-id="item.id" :class="{ 'is-editing': editing }">
    <div class="bubble">
      <p v-if="item.text" class="row-text">{{ item.text }}</p>

      <div v-if="images.length" class="row-images">
        <button
          v-for="image in images"
          :key="image.id"
          type="button"
          class="thumb"
          :aria-label="image.name"
          @click="emit('preview', image)"
        >
          <img :src="image.url" :alt="image.name" />
        </button>
      </div>

      <div v-if="files.length" class="row-files">
        <span v-for="file in files" :key="file.id" class="file-chip">
          <FileTextIcon class="file-icon" aria-hidden="true" />
          <span class="file-name">{{ file.name }}</span>
          <span class="file-size">{{ formatFileSize(file.size) }}</span>
        </span>
      </div>
    </div>

    <div class="row-actions">
      <Tooltip v-for="action in actions" :key="action.id">
        <TooltipTrigger>
          <template #render="{ props: part }">
            <IconButton
              v-bind="part"
              type="button"
              size="s"
              variant="ghost"
              color="neutral"
              :class="action.class"
              :aria-label="action.label"
              :disabled="action.disabled ?? false"
              @click="action.run?.()"
            >
              <component :is="action.icon" aria-hidden="true" />
            </IconButton>
          </template>
        </TooltipTrigger>

        <TooltipContent>{{ action.label }}</TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from "vue"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@pig/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import type { ComposerAttachment } from "@/types/attachment-type.js"
import { formatFileSize } from "@features/composer/lib/attachment-size.js"
import type { QueuedPrompt } from "@features/composer/hooks/use-composer-queue.js"
import {
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FileTextIcon,
  GripVerticalIcon,
  PenIcon,
  TrashIcon,
} from "@components/icons/index.js"

interface RowAction {
  id: string
  icon: Component
  label: string
  class?: string
  disabled?: boolean
  run?: () => void
}

const props = defineProps<{
  item: QueuedPrompt
  editing: boolean
  canUp: boolean
  canDown: boolean
}>()
const emit = defineEmits<{
  move: [delta: -1 | 1]
  edit: []
  sendNow: []
  remove: []
  preview: [item: ComposerAttachment]
}>()
const { t } = useI18n()
const images = computed(() => props.item.attachmentsPreview.filter((file) => file.url))
const files = computed(() => props.item.attachmentsPreview.filter((file) => !file.url))
const actions = computed<RowAction[]>(() => {
  const labelText =
    props.item.text || props.item.attachmentsPreview.map((file) => file.name).join(", ")
  return [
    {
      id: "grip",
      icon: GripVerticalIcon,
      label: t("composer.queueDrag"),
      class: "row-grip",
    },
    {
      id: "up",
      icon: ChevronUpIcon,
      label: t("composer.queueMoveUp", { text: labelText }),
      disabled: !props.canUp,
      run: () => emit("move", -1),
    },
    {
      id: "down",
      icon: ChevronDownIcon,
      label: t("composer.queueMoveDown", { text: labelText }),
      disabled: !props.canDown,
      run: () => emit("move", 1),
    },
    {
      id: "send",
      icon: ArrowUpIcon,
      label: t("composer.queueSendNow"),
      run: () => emit("sendNow"),
    },
    {
      id: "edit",
      icon: PenIcon,
      label: t("composer.queueEdit"),
      run: () => emit("edit"),
    },
    {
      id: "remove",
      icon: TrashIcon,
      label: t("composer.queueRemove", { text: labelText }),
      run: () => emit("remove"),
    },
  ]
})
</script>

<style scoped>
.row {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2xs);
  max-inline-size: 85%;
  touch-action: pan-y;
}

.row.is-drag-live {
  z-index: var(--z-sticky);
  cursor: grabbing;
}

.bubble {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  max-inline-size: 100%;
  padding: var(--space-xs) var(--space-sm);
  border: var(--border-width) dashed var(--border-strong);
  border-radius: var(--radius-card);
  background: transparent;
  color: var(--fg);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

.row.is-editing .bubble {
  border-color: var(--accent-solid);
  background: var(--bg-selected);
}

.row.is-drag-live .bubble {
  background: var(--bg-surface);
  box-shadow: var(--shadow-popover);
}

.row-text {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.row-images {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2xs);
}

.thumb {
  inline-size: 56px;
  block-size: 56px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-control);
  overflow: hidden;
  background: var(--bg-muted);
  cursor: zoom-in;
}

.thumb img {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}

.row-files {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2xs);
}

.file-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
  max-inline-size: 100%;
  padding: var(--space-2xs) var(--space-xs);
  border-radius: var(--radius-control);
  background: var(--bg-muted);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.file-icon {
  flex: none;
  inline-size: var(--icon-sm);
  block-size: var(--icon-sm);
  color: var(--fg-muted);
}

.file-name {
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--fg);
}

.file-size {
  flex: none;
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
}

.row-actions {
  display: flex;
  align-items: center;
}

.row-grip {
  cursor: grab;
  touch-action: none;
}
</style>
