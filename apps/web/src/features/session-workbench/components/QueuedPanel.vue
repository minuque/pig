<template>
  <QueuedMessages
    v-if="queue.items.value.length"
    :items="queue.items.value"
    :editing-id="editingId"
    @reorder="queue.reorder"
    @edit="emit('edit', $event)"
    @send-now="emit('sendNow', $event)"
    @remove="emit('remove', $event)"
    @preview="preview = $event"
  />

  <PreviewDialog
    v-if="preview"
    open
    :src="preview.url"
    :title="preview.name"
    @update:open="preview = undefined"
  />
</template>

<script setup lang="ts">
import { ref } from "vue"
import { QueuedMessages } from "@features/composer/index.js"
import PreviewDialog from "@features/preview/index.vue"
import type { ComposerAttachment } from "@/types/attachment-type.js"
import type { ComposerQueueApi, QueuedPrompt } from "@features/composer/hooks/use-composer-queue.js"

defineProps<{ queue: ComposerQueueApi; editingId: string | null }>()

const emit = defineEmits<{
  edit: [item: QueuedPrompt]
  sendNow: [item: QueuedPrompt]
  remove: [id: string]
}>()
const preview = ref<ComposerAttachment>()
</script>
