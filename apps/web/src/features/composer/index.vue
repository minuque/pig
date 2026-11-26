<template>
  <form
    class="prompt"
    :data-mention-over="mentionDrop.over.value || undefined"
    @submit.prevent="submitIntent"
    @dragenter.capture="mentionDrop.onDrag"
    @dragover.capture="mentionDrop.onDrag"
    @dragleave="mentionDrop.onLeave"
    @drop.capture="mentionDrop.onDrop"
  >
    <PromptEditor
      ref="editor"
      v-model:prompt="prompt"
      :placeholder="answer?.placeholder"
      :disabled="answer?.locked ?? false"
      :cwd="cwd"
      :has-session="Boolean(sessionId)"
      :reload-revision="reloadRevision"
      :editing-queue="editingQueue"
      @submit="submitIntent"
      @paste-files="attachments.addFiles"
      @open-file="emit('openFile', $event)"
      @jump-reply="emit('jumpReply', $event)"
      @cancel-queue-edit="emit('cancelQueueEdit')"
      @history-prev="emit('historyPrev')"
      @history-next="emit('historyNext')"
    >
      <template v-if="$slots.plate" #plate>
        <slot name="plate" />
      </template>

      <template #attachments>
        <AttachmentTray
          :files="attachmentFiles"
          :error="attachmentError"
          :status="attachmentStatus"
          :progress="attachmentProgress"
          :errors="attachmentErrors"
          @remove="attachments.remove"
          @retry="attachments.retryItem"
          @preview="onPreview"
          @dismiss-error="attachments.dismissError"
        />
      </template>

      <template #left>
        <Tooltip>
          <TooltipTrigger>
            <template #render="{ props: part }">
              <IconButton
                v-bind="part"
                type="button"
                size="s"
                variant="ghost"
                color="neutral"
                :aria-label="t('composer.addAttachment')"
                :disabled="attachmentsFull"
                @mousedown.prevent
                @click="pickFiles"
              >
                <PaperclipIcon class="size-icon" />
              </IconButton>
            </template>
          </TooltipTrigger>

          <TooltipContent>{{ t("composer.addAttachment") }}</TooltipContent>
        </Tooltip>

        <input ref="fileInput" type="file" multiple hidden @change="onFilesPicked" />
      </template>

      <template #tools>
        <ModelPicker
          v-model:open="modelPickerOpen"
          v-model:model="model"
          v-model:level="level"
          :catalog="catalog"
          :locked="switchLocked"
        >
          <template #trailing>
            <ContextRing v-if="usage" :usage="usage" />
          </template>
        </ModelPicker>
      </template>

      <template #right>
        <ComposerPrimaryAction
          :running="running"
          :steer-held="steerHeld"
          :editing-queue="editingQueue"
          :stop-phase="stopPhase"
          :send-disabled="sendDisabled"
          :has-payload="hasPayload"
          :has-attachments="hasAttachments"
          :answer="answer"
          @submit="submitIntent"
          @abort="emit('abort')"
        />
      </template>
    </PromptEditor>

    <PreviewDialog
      v-if="previewItem"
      open
      :src="previewItem.url"
      :title="previewItem.name"
      @update:open="previewItem = undefined"
    />
  </form>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@pig/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import AttachmentTray from "@features/composer/components/AttachmentTray.vue"
import ComposerPrimaryAction from "@features/composer/components/ComposerPrimaryAction.vue"
import ContextRing from "@features/composer/components/ContextRing.vue"
import ModelPicker from "@features/composer/components/ModelPicker.vue"
import PromptEditor from "@features/composer/components/PromptEditor.vue"
import PreviewDialog from "@features/preview/index.vue"
import type { ComposerAttachment } from "@/types/attachment-type.js"
import { useComposerAbortHotkey } from "@features/composer/hooks/use-composer-abort-hotkey.js"
import { useMentionDrop } from "@features/composer/hooks/use-mention-drop.js"
import {
  MAX_COMPOSER_ATTACHMENTS,
  type ComposerAttachmentsApi,
} from "@features/composer/hooks/use-composer-attachments.js"
import type {
  ComposerModel,
  ComposerPreset,
  ComposerVendor,
  ContextUsage,
  ReplyInsertRequest,
  StopPhase,
} from "@features/composer/type.js"
import { PaperclipIcon } from "@components/icons/index.js"

const { t } = useI18n()
const props = withDefaults(
  defineProps<{
    catalog: ComposerVendor[]
    attachments: ComposerAttachmentsApi
    running?: boolean
    switchLocked?: boolean
    editingQueue?: boolean
    stopPhase?: StopPhase
    sendDisabled?: boolean
    sessionId?: string | undefined
    cwd?: string | undefined
    usage?: ContextUsage | undefined
    reloadRevision?: number | undefined
    answer?:
      | { locked: boolean; placeholder?: string | undefined; label: string; ready: boolean }
      | undefined
  }>(),
  {
    running: false,
    switchLocked: false,
    editingQueue: false,
    stopPhase: "idle",
    sendDisabled: false,
    sessionId: undefined,
    cwd: undefined,
    usage: undefined,
    reloadRevision: undefined,
    answer: undefined,
  },
)
const prompt = defineModel<string>("prompt", { required: true })
const preset = defineModel<ComposerPreset | undefined>("preset")
const emit = defineEmits<{
  send: [text: string]
  steer: [text: string]
  queue: [text: string]
  saveEdit: []
  abort: []
  openFile: [path: string]
  jumpReply: [target: { sessionId: string; entryId: string; text?: string | undefined }]
  cancelQueueEdit: []
  historyPrev: []
  historyNext: []
}>()
const model = computed({
  get: () => preset.value?.model,
  set: (next: ComposerModel | undefined) => {
    if (next) preset.value = { model: next, thinkingLevel: preset.value?.thinkingLevel ?? "" }
  },
})
const level = computed({
  get: () => preset.value?.thinkingLevel ?? "",
  set: (thinkingLevel: string) => {
    if (preset.value) preset.value = { ...preset.value, thinkingLevel }
  },
})
const modelPickerOpen = ref(false)
const previewItem = ref<ComposerAttachment>()
const fileInput = useTemplateRef("fileInput")
const editor = useTemplateRef("editor")
const attachmentFiles = computed(() => props.attachments.files.value)
const attachmentStatus = computed(() => props.attachments.status.value)
const attachmentProgress = computed(() => props.attachments.progress.value)
const attachmentErrors = computed(() => props.attachments.errors.value)
const attachmentError = computed(() => props.attachments.error.value)
const attachmentsFull = computed(() => attachmentFiles.value.length >= MAX_COMPOSER_ATTACHMENTS)
const hasAttachments = computed(() => attachmentFiles.value.length > 0)
const hasPayload = computed(() => prompt.value.trim().length > 0 || hasAttachments.value)
const steerHeld = computed(() => editor.value?.steerHeld ?? false)
const insertMarkdown = (markdown: string) => editor.value?.insertMarkdown(markdown)
const insertReply = (request: ReplyInsertRequest) => editor.value?.insertReply(request)
const mentionDrop = useMentionDrop(insertMarkdown)

defineExpose({ insertMarkdown, insertReply })

watch(
  () => props.sessionId,
  () => {
    modelPickerOpen.value = false
  },
)

useComposerAbortHotkey({
  running: () => props.running,
  stopping: () => props.stopPhase === "pending",
  blocked: () =>
    Boolean(previewItem.value) ||
    modelPickerOpen.value ||
    props.editingQueue ||
    Boolean(editor.value?.replyCommentOpen),
  menuOpen: () => editor.value?.menuOpen ?? false,
  abort: () => emit("abort"),
})

function submitIntent() {
  if (props.answer) {
    if (props.answer.ready) emit("send", prompt.value)
    return
  }

  if (!hasPayload.value) return

  if (props.editingQueue) {
    emit("saveEdit")
    return
  }

  if (props.sendDisabled || props.stopPhase === "pending" || props.stopPhase === "landed") return

  if (props.running) {
    if (steerHeld.value) emit("steer", prompt.value)
    else emit("queue", prompt.value)
    return
  }

  emit("send", prompt.value)
}

function pickFiles() {
  fileInput.value?.click()
}

function onFilesPicked(event: Event) {
  const input = event.target as HTMLInputElement

  props.attachments.addFiles(input.files)
  input.value = ""
}

function onPreview(item: ComposerAttachment) {
  previewItem.value = item
}

watch(previewItem, (item, previous) => {
  if (previous && !item) editor.value?.focus()
})
</script>

<style scoped>
.prompt {
  position: relative;
  display: flex;
  flex-direction: column;
  min-block-size: 0;
  width: 100%;
  margin-inline: auto;
  padding: 0;
  background: transparent;
}

.prompt[data-mention-over] :deep(.composer-card),
:global(.session-panel[data-session-drop-over]) .prompt :deep(.composer-card) {
  box-shadow:
    0 0 0 var(--border-width) var(--accent-solid),
    var(--float-elevation);
}
</style>
