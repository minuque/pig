<template>
  <div v-if="files.length || error" class="attach-tray">
    <p v-if="error" class="attach-error" role="alert">
      <span class="attach-error-text">{{ error }}</span>

      <IconButton
        type="button"
        size="s"
        variant="ghost"
        color="neutral"
        radius="full"
        class="attach-error-close"
        :aria-label="t('composer.attachmentDismissError')"
        @click="emit('dismissError')"
      >
        <XIcon class="size-icon" />
      </IconButton>
    </p>

    <TransitionGroup tag="div" name="chip" class="tiles">
      <AttachmentChip
        v-for="row in mediaRows"
        :key="row.item.id"
        :item="row.item"
        :status="row.status"
        :progress="row.progress"
        :failure="row.failure"
        @remove="emit('remove', $event)"
        @preview="emit('preview', $event)"
        @retry="emit('retry', $event)"
      />
    </TransitionGroup>

    <TransitionGroup tag="div" name="chip" class="rows">
      <AttachmentChip
        v-for="row in fileRows"
        :key="row.item.id"
        :item="row.item"
        :status="row.status"
        :progress="row.progress"
        :failure="row.failure"
        @remove="emit('remove', $event)"
        @preview="emit('preview', $event)"
        @retry="emit('retry', $event)"
      />
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@components/ui/button/index.js"
import { XIcon } from "@components/icons/index.js"
import type { ComposerAttachment } from "@/types/attachment-type.js"
import AttachmentChip from "@features/composer/components/AttachmentChip.vue"
import type { AttachmentStatus } from "@features/composer/lib/attachment-upload.js"

const props = withDefaults(
  defineProps<{
    files: ComposerAttachment[]
    error?: string
    status?: Record<string, AttachmentStatus>
    progress?: Record<string, number>
    errors?: Record<string, string>
  }>(),
  { error: "", status: () => ({}), progress: () => ({}), errors: () => ({}) },
)
const emit = defineEmits<{
  remove: [id: string]
  preview: [item: ComposerAttachment]
  retry: [id: string]
  dismissError: []
}>()
const { t } = useI18n()
const rows = computed(() =>
  props.files.map((item) => ({
    item,
    media: Boolean(item.url),
    status: props.status[item.id] ?? "idle",
    progress: props.progress[item.id] ?? 0,
    failure: props.errors[item.id] ?? "",
  })),
)
const mediaRows = computed(() => rows.value.filter((row) => row.media))
const fileRows = computed(() => rows.value.filter((row) => !row.media))
</script>

<style scoped>
.attach-tray {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  min-width: 0;
}

.attach-error {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  margin: 0;
  color: var(--danger-text);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.attach-error-text {
  flex: 1;
  min-width: 0;
}

.attach-error-close {
  flex: none;
  color: var(--danger-text);
}

.tiles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.chip-enter-active,
.chip-leave-active {
  transition:
    opacity var(--duration-normal) var(--ease-out),
    scale var(--duration-normal) var(--ease-out);
}

.chip-enter-from,
.chip-leave-to {
  opacity: 0;
  scale: 0.9;
}

.chip-move {
  transition: transform var(--duration-normal) var(--ease-out);
}

@media (prefers-reduced-motion: reduce) {
  .chip-enter-active,
  .chip-leave-active,
  .chip-move {
    transition: none;
  }
}
</style>
