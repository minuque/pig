<template>
  <div class="row" role="listitem" :data-id="item.id" :class="{ 'is-editing': editing }">
    <GripVerticalIcon class="row-grip" aria-hidden="true" />

    <div class="row-body">
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
    </div>

    <div class="row-actions">
      <IconButton
        type="button"
        size="s"
        variant="ghost"
        color="neutral"
        class="action"
        :aria-label="t('composer.queueMoveUp', { text: item.text })"
        :disabled="!canUp"
        @click="emit('move', -1)"
      >
        <ChevronUpIcon class="action-icon" aria-hidden="true" />
      </IconButton>

      <IconButton
        type="button"
        size="s"
        variant="ghost"
        color="neutral"
        class="action"
        :aria-label="t('composer.queueMoveDown', { text: item.text })"
        :disabled="!canDown"
        @click="emit('move', 1)"
      >
        <ChevronDownIcon class="action-icon" aria-hidden="true" />
      </IconButton>

      <Button
        type="button"
        size="s"
        variant="ghost"
        color="neutral"
        class="send-now"
        @click="emit('sendNow')"
      >
        {{ t("composer.queueSendNow") }}
      </Button>

      <IconButton
        type="button"
        size="s"
        variant="ghost"
        color="neutral"
        class="action"
        :aria-label="t('composer.queueEdit')"
        @click="emit('edit')"
      >
        <PenIcon class="action-icon" aria-hidden="true" />
      </IconButton>

      <IconButton
        type="button"
        size="s"
        variant="ghost"
        color="neutral"
        class="action"
        :aria-label="t('composer.queueRemove', { text: item.text })"
        @click="emit('remove')"
      >
        <TrashIcon class="action-icon" aria-hidden="true" />
      </IconButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { Button, IconButton } from "@components/ui/button/index.js"
import type { ComposerAttachment } from "@/types/attachment-type.js"
import type { QueuedPrompt } from "@features/composer/hooks/use-composer-queue.js"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  GripVerticalIcon,
  PenIcon,
  TrashIcon,
} from "@components/icons/index.js"

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
</script>

<style scoped>
.row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-xs);
  max-inline-size: 85%;
  padding: var(--space-2xs) var(--space-xs);
  border: var(--border-width) dashed var(--border);
  border-radius: var(--radius-card);
  color: var(--fg);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  touch-action: pan-y;
}

.row.is-editing {
  border-color: var(--accent-solid);
  background: var(--bg-selected);
}

.row.is-drag-live {
  z-index: var(--z-sticky);
  box-shadow: var(--shadow-popover);
  cursor: grabbing;
}

.row-grip {
  flex: none;
  inline-size: var(--icon-md);
  block-size: var(--icon-md);
  margin-block-start: var(--space-2xs);
  color: var(--fg-muted);
  cursor: grab;
  touch-action: none;
}

.row-body {
  flex: 1;
  min-inline-size: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
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

.row-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  flex: none;
}

.action-icon {
  inline-size: 13px;
  block-size: 13px;
  color: currentColor;
}

.send-now {
  font-size: var(--text-meta);
}
</style>
