<template>
  <form class="prompt" @submit.prevent="onSubmit">
    <Transition name="fade-layer">
      <QueuePanel
        v-if="queueItems.length"
        :items="queueItems"
        @reorder="queue.reorder"
        @edit="onQueueEdit"
        @send-now="emit('sendNow', $event)"
        @remove="queue.remove"
      />
    </Transition>

    <PromptEditor
      ref="editor"
      v-model:prompt="prompt"
      :cwd="cwd"
      @submit="onSubmit"
      @paste-files="attachments.addFiles"
    >
      <template v-if="attachmentFiles.length || attachmentError" #attachments>
        <div class="attach-tray">
          <p v-if="attachmentError" class="attach-error" role="alert">{{ attachmentError }}</p>

          <AttachmentChips
            :files="attachmentFiles"
            :progress="attachmentProgress"
            @remove="attachments.remove"
            @preview="onPreview"
          />
        </div>
      </template>

      <template #left>
        <Tooltip>
          <TooltipTrigger as-child>
            <IconButton
              type="button"
              size="s"
              class="attach press-scale"
              :aria-label="t('composer.addAttachment')"
              :disabled="attachmentsFull"
              @mousedown.prevent
              @click="pickFiles"
            >
              <PaperclipIcon class="attach-icon" />
            </IconButton>
          </TooltipTrigger>

          <TooltipContent>{{ t("composer.addAttachment") }}</TooltipContent>
        </Tooltip>

        <input
          ref="fileInput"
          class="file-input"
          type="file"
          multiple
          hidden
          @change="onFilesPicked"
        />
      </template>

      <template #tools>
        <ModelPicker
          v-model:open="modelPickerOpen"
          v-model:model="model"
          v-model:level="level"
          :catalog="catalog"
        >
          <ContextRing v-if="usage" :usage="usage" />
        </ModelPicker>
      </template>

      <template #right>
        <Tooltip>
          <TooltipTrigger as-child>
            <IconButton
              type="button"
              size="s"
              class="send press-scale"
              :class="{ 'send--abort': primaryMode === 'stop' }"
              :aria-label="primaryLabel"
              :aria-keyshortcuts="primaryMode === 'stop' ? 'Escape' : 'Enter'"
              :disabled="primaryDisabled"
              @mousedown.prevent
              @click="onPrimaryAction"
            >
              <span v-if="primaryMode === 'stop'" class="stop-square" aria-hidden="true"></span>
              <ArrowUpIcon v-else class="size-icon send-arrow" aria-hidden="true" />
            </IconButton>
          </TooltipTrigger>

          <TooltipContent>
            <!-- 外部：元素间的换行空白会被编译器丢掉 -->
            <span>{{ primaryLabel }}</span>
            <kbd v-if="primaryMode !== 'stop'" class="tooltip-hint">↵</kbd>
          </TooltipContent>
        </Tooltip>
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
import { useEventListener } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import AttachmentChips from "@features/composer/components/AttachmentChips.vue"
import PreviewDialog from "@features/preview/index.vue"
import ModelPicker from "@features/composer/components/ModelPicker.vue"
import ContextRing from "@features/composer/components/ContextRing.vue"
import PromptEditor from "@features/composer/components/PromptEditor.vue"
import QueuePanel from "@features/composer/components/QueuePanel.vue"
import type { ComposerAttachment } from "@/types/attachment-type.js"
import {
  MAX_COMPOSER_ATTACHMENTS,
  type ComposerAttachmentsApi,
} from "@features/composer/hooks/use-composer-attachments.js"
import type { ComposerQueueApi, QueuedPrompt } from "@features/composer/hooks/use-composer-queue.js"
import type {
  ComposerModel,
  ComposerPreset,
  ComposerVendor,
  ContextUsage,
} from "@features/composer/type.js"
import { ArrowUpIcon, PaperclipIcon } from "@components/icons/index.js"

const { t } = useI18n()
const props = withDefaults(
  defineProps<{
    catalog: ComposerVendor[]
    attachments: ComposerAttachmentsApi
    running?: boolean
    aborting?: boolean
    sendDisabled?: boolean
    sessionId?: string | undefined
    cwd?: string | undefined
    usage?: ContextUsage | undefined
    queue: ComposerQueueApi
  }>(),
  {
    running: false,
    aborting: false,
    sendDisabled: false,
    sessionId: undefined,
    cwd: undefined,
    usage: undefined,
  },
)
const prompt = defineModel<string>("prompt", { required: true })
const preset = defineModel<ComposerPreset | undefined>("preset")
const emit = defineEmits<{
  send: [text: string]
  sendNow: [item: QueuedPrompt]
  queue: [text: string]
  abort: []
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
const sendActive = computed(() => prompt.value.trim() !== "" && !props.sendDisabled)
const modelPickerOpen = ref(false)
const previewItem = ref<ComposerAttachment>()
const fileInput = useTemplateRef("fileInput")
const editor = useTemplateRef("editor")
const attachmentFiles = computed(() => props.attachments.files.value)
const queueItems = computed(() => props.queue.items.value)
const attachmentProgress = computed(() => props.attachments.progress.value)
const attachmentError = computed(() => props.attachments.error.value)
const attachmentsFull = computed(() => attachmentFiles.value.length >= MAX_COMPOSER_ATTACHMENTS)

type PrimaryMode = "send" | "queue" | "stop"

const primaryMode = computed<PrimaryMode>(() => {
  if (props.running) return sendActive.value ? "queue" : "stop"
  return "send"
})
const primaryLabel = computed(() => {
  switch (primaryMode.value) {
    case "stop":
      return t("composer.stopTurn")
    case "queue":
      return t("composer.queuePrompt")
    default:
      return t("composer.sendPrompt")
  }
})
const primaryDisabled = computed(() => {
  if (primaryMode.value === "stop") return props.aborting
  return !sendActive.value
})

watch(
  () => props.sessionId,
  () => {
    modelPickerOpen.value = false
  },
)

useEventListener(window, "keydown", onAbortHotkey, { capture: true })

function submitIntent() {
  if (!sendActive.value) return

  if (props.running) emit("queue", prompt.value)
  else emit("send", prompt.value)
}

function onSubmit() {
  submitIntent()
}

function onPrimaryAction() {
  if (primaryMode.value === "stop") {
    if (!props.aborting) emit("abort")
    return
  }

  submitIntent()
}

function onQueueEdit(item: QueuedPrompt) {
  prompt.value = item.text

  if (item.attachments) props.attachments.addFiles(item.attachments.files.map((f) => f.file))
  props.queue.remove(item.id)
  editor.value?.focus()
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

function onAbortHotkey(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.isComposing) return

  if (event.altKey || event.ctrlKey || event.metaKey) return

  if (previewItem.value || !props.running || props.aborting || modelPickerOpen.value) return
  const active = document.activeElement

  if (
    active instanceof Element &&
    active.closest(
      "[data-slot='dialog-content'], [data-slot='alert-dialog-content'], [data-slot='dropdown-menu-content'], [data-slot='context-menu-content']",
    )
  ) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  emit("abort")
}
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
  border: 0;
  border-radius: 0;
  background: transparent;
}

.attach-tray {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  width: 100%;
  min-width: 0;
}

.attach-error {
  margin: 0;
  color: var(--danger-text);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.attach {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--control-md);
  height: var(--control-md);
  min-width: var(--control-md);
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--fg);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.attach:not(:disabled):hover {
  background: var(--bg-hover);
  color: var(--fg);
}

.attach:disabled {
  cursor: default;
  opacity: var(--opacity-disabled);
}

.send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--control-md);
  height: var(--control-md);
  min-width: var(--control-md);
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out);
  background: var(--accent-solid);
  color: var(--fg-on-accent);
}

.send:not(:disabled):hover {
  background: var(--accent-solid-hover);
}

.send--abort,
.send--abort:not(:disabled):hover {
  background: var(--danger-solid);
  color: var(--white);
  box-shadow: none;
}

.send--abort:not(:disabled):hover {
  opacity: 0.85;
}

.send:disabled {
  cursor: default;
  scale: 1;
  background: var(--bg-emphasis);
  color: var(--fg-secondary);
  box-shadow: none;
}

.send--abort:disabled {
  opacity: var(--opacity-disabled);
}

.stop-square {
  width: 11px;
  height: 11px;
  border-radius: 3px;
  background: currentColor;
}

.send-arrow {
  stroke-width: 2.5px;
}

.tooltip-hint {
  margin-inline-start: var(--space-2xs);
  font: inherit;
  opacity: 0.55;
}

@media (prefers-reduced-motion: reduce) {
  .send,
  .attach {
    transition: none;
  }
}

.send:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

.attach:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

.attach-icon {
  inline-size: var(--icon-lg);
  block-size: var(--icon-lg);
}
</style>
