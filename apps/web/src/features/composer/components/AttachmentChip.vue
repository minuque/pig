<template>
  <div
    :class="['chip', item.url ? 'chip--media' : 'chip--file']"
    :data-status="status"
    :title="failure"
  >
    <button
      v-if="item.url"
      type="button"
      class="tile"
      :aria-label="t('common.preview', { name: item.name })"
      @click="emit('preview', item)"
    >
      <img class="tile-image" :src="item.url" :alt="item.name" />
    </button>

    <template v-else>
      <FileTextIcon class="file-icon" aria-hidden="true" />
      <OverflowTooltip class="file-name" :text="item.name" />
      <span class="file-size">{{ formatFileSize(item.size) }}</span>
    </template>

    <Progress
      v-if="status === 'uploading'"
      class="progress"
      :value="progress"
      :aria-label="item.name"
    >
      <ProgressIndicator class="fill" />
    </Progress>

    <Button
      v-if="status === 'error'"
      type="button"
      size="s"
      variant="ghost"
      color="danger"
      class="retry"
      @click="emit('retry', item.id)"
    >
      {{ t("composer.attachmentRetry") }}
    </Button>

    <span v-if="status === 'error' && failure" class="chip-error" role="alert">{{ failure }}</span>

    <IconButton
      type="button"
      size="s"
      :variant="item.url ? 'solid' : 'ghost'"
      color="neutral"
      radius="full"
      class="remove"
      :aria-label="t('composer.removeAttachment', { name: item.name })"
      @click="emit('remove', item.id)"
    >
      <XIcon class="size-icon" />
    </IconButton>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"
import { Button, IconButton } from "@pig/ui/button"
import { FileTextIcon, XIcon } from "@components/icons/index.js"
import type { ComposerAttachment } from "@/types/attachment-type.js"
import { formatFileSize } from "@features/composer/lib/attachment-size.js"
import type { AttachmentStatus } from "@features/composer/lib/attachment-upload.js"
import { Progress, ProgressIndicator } from "@pig/ui/progress"
import { OverflowTooltip } from "@pig/ui/tooltip"

withDefaults(
  defineProps<{
    item: ComposerAttachment
    status?: AttachmentStatus
    progress?: number
    failure?: string
  }>(),
  { status: "idle", progress: 0, failure: "" },
)

const emit = defineEmits<{
  remove: [id: string]
  preview: [item: ComposerAttachment]
  retry: [id: string]
}>()
const { t } = useI18n()
</script>

<style scoped>
.chip {
  position: relative;
  flex: none;
  min-width: 0;
  border-radius: var(--radius-control);
}

.chip--media {
  inline-size: 64px;
  block-size: 64px;
  overflow: hidden;
  background: var(--bg-muted);
}

.tile {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: zoom-in;
}

.tile-image {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}

.chip--media[data-status="uploading"] .tile {
  opacity: 0.6;
}

.chip--file {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-block-size: var(--control-md);
  padding-inline-start: var(--space-xs);
  background: var(--bg-muted);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.file-icon {
  flex: none;
  inline-size: var(--icon-lg);
  block-size: var(--icon-lg);
  color: var(--fg-muted);
}

.file-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--fg);
}

.file-size {
  flex: none;
  color: var(--fg-muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.progress {
  flex: none;
  inline-size: 40px;
  block-size: 3px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  corner-shape: round;
  background: var(--bg-emphasis);
}

.fill {
  display: block;
  block-size: 100%;
  background: var(--info-solid);
  transition: inline-size var(--duration-fast) linear;
}

.chip--media .progress {
  position: absolute;
  inset-block-end: 0;
  inset-inline: 0;
  inline-size: auto;
  block-size: 2px;
  border-radius: 0;
  background: transparent;
}

.retry {
  flex: none;
}

.chip-error {
  max-inline-size: 200px;
  overflow: hidden;
  color: var(--danger-text);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip--media .chip-error {
  position: absolute;
  inset-block-end: 0;
  inset-inline: 0;
  max-inline-size: none;
  padding-inline: var(--space-2xs);
  background: var(--danger-subtle);
}

.remove {
  flex: none;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.chip--media .remove {
  position: absolute;
  inset-block-start: 2px;
  inset-inline-end: 2px;
}

.chip:hover .remove,
.chip:focus-within .remove,
.remove:focus-visible {
  opacity: 1;
}

@media (pointer: coarse) {
  .remove {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fill,
  .remove {
    transition: none;
  }
}
</style>
