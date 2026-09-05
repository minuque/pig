<template>
  <component
    :is="bare ? 'div' : 'form'"
    class="prompt"
    :class="{ bare }"
    @submit.prevent="send"
    @paste="onPaste"
  >
    <Transition name="panel-reveal">
      <ContextUsagePanel
        v-if="usageOpen && usage"
        :usage="usage"
        :session-id="sessionId"
        @close="usageOpen = false"
      />
    </Transition>
    <PromptEditor
      ref="promptEditor"
      v-model:prompt="prompt"
      :placeholder="placeholder"
      :running="running"
      :active="modelPickerActive || voiceActive"
      :has-chips="attachments.length > 0 || Boolean($slots.chips)"
      :readonly="voiceActive"
      @submit="send"
    >
      <template v-if="attachments.length || $slots.chips" #chips>
        <AttachmentThumb
          v-for="item in attachments"
          :key="item.id"
          :src="item.url"
          :name="item.name"
          @remove="removeAttachment(item.id)"
        />
        <slot name="chips" />
      </template>
      <template #left>
        <template v-if="!voiceActive">
          <slot name="left" />
          <ModelPicker
            v-model:open="modelPickerOpen"
            v-model:active="modelPickerActive"
            v-model:model="model"
            :catalog="catalog"
            :disabled="running || voiceActive"
          />
          <ThinkingLevelSelect
            v-if="modelLevels.length > 1"
            v-model:level="level"
            :levels="modelLevels"
            :disabled="running || voiceActive"
          />
        </template>
      </template>
      <template #right="{ expanded }">
        <span v-if="voiceActive" class="voice-status" role="status">正在聆听…</span>
        <Button
          v-show="expanded && !voiceActive"
          type="button"
          size="icon"
          class="plus press-scale"
          aria-label="添加图片，最多 6 张，仅本地预览"
          title="添加图片，仅本地预览"
          :disabled="attachments.length >= MAX_CHAT_INPUT_ATTACHMENTS"
          @mousedown.prevent
          @click="openFilePicker"
        >
          <Plus class="size-icon" />
        </Button>
        <Tooltip v-if="error" :delay-duration="200">
          <TooltipTrigger as-child>
            <Button type="button" size="icon" class="error-indicator" :aria-label="error">
              <CircleAlert class="size-icon" />
            </Button>
          </TooltipTrigger>
          <TooltipContent class="max-w-[360px]">{{ error }}</TooltipContent>
        </Tooltip>
        <Button
          type="button"
          size="icon"
          class="send press-scale"
          :class="{ 'send--abort': running || voiceActive, 'motion-pulse': voiceActive }"
          :title="primaryLabel"
          :aria-label="primaryLabel"
          :disabled="running ? aborting : !voiceActive && !showVoice && !sendActive"
          @mousedown.prevent
          @click="onPrimaryAction"
        >
          <span class="primary-icon icon-swap" aria-hidden="true">
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="currentColor"
              :data-visible="running || voiceActive"
            >
              <rect x="2" y="2" width="8" height="8" rx="1.5" />
            </svg>
            <ArrowUp :data-visible="!running && !voiceActive && !showVoice" class="size-icon" />
            <Mic :data-visible="!running && !voiceActive && showVoice" class="size-icon" />
          </span>
        </Button>
      </template>
    </PromptEditor>
    <p v-if="voiceMessage" class="voice-message" role="status">{{ voiceMessage }}</p>
    <ChatInputMeta :cwd="cwd" :usage="usage" :open="usageOpen" @toggle="usageOpen = !usageOpen" />
    <input
      ref="fileInput"
      type="file"
      class="file-input"
      accept="image/*"
      multiple
      tabindex="-1"
      @change="onFilesPicked"
    />
  </component>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { ArrowUp, CircleAlert, Mic, Plus } from "@lucide/vue"
import { Button } from "@components/ui/button/index.js"
import { useVoiceInput } from "@features/chat-input/hooks/use-voice-input.js"
import AttachmentThumb from "@features/chat-input/components/AttachmentThumb.vue"
import ChatInputMeta from "@features/chat-input/components/ChatInputMeta.vue"
import ContextUsagePanel from "@features/chat-input/components/ContextUsagePanel.vue"
import ModelPicker from "@features/chat-input/components/ModelPicker.vue"
import ThinkingLevelSelect from "@features/chat-input/components/ThinkingLevelSelect.vue"
import PromptEditor from "@features/chat-input/components/PromptEditor.vue"
import type { ChatInputModel, ChatInputPreset, ChatInputVendor } from "@/types/chat-input-type.js"
import type { ContextUsage } from "@features/chat-input/type.js"
import { resolveModelInfo } from "@features/chat-input/lib/model-preset.js"
import {
  MAX_CHAT_INPUT_ATTACHMENTS,
  imageFilesFromClipboard,
  useChatInputAttachments,
} from "@features/chat-input/hooks/use-chat-input-attachments.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"

const props = withDefaults(
  defineProps<{
    catalog: ChatInputVendor[]
    /** 运行中把发送钮改成停止 */
    running?: boolean
    /** Abort 请求进行中：保持停止态并禁用重复点击 */
    aborting?: boolean
    error?: string
    /** 外部禁用发送（如 welcome 的 workspace/预设/提交中守卫） */
    sendDisabled?: boolean
    placeholder?: string
    /** 嵌入其他布局时以 div 渲染，避免嵌套 form */
    bare?: boolean
    /** 当前工作目录，底栏展示末段名 */
    cwd?: string | undefined
    usage?: ContextUsage | undefined
    sessionId?: string | undefined
  }>(),
  {
    running: false,
    aborting: false,
    error: "",
    sendDisabled: false,
    placeholder: "do what you want ...",
    bare: false,
    cwd: undefined,
    usage: undefined,
    sessionId: undefined,
  },
)

const prompt = defineModel<string>("prompt", { required: true })
const preset = defineModel<ChatInputPreset | undefined>("preset")

const emit = defineEmits<{
  send: [text: string]
  abort: []
}>()

const model = computed({
  get: () => preset.value?.model,
  set: (next: ChatInputModel | undefined) => {
    if (next) preset.value = { model: next, thinkingLevel: preset.value?.thinkingLevel ?? "" }
  },
})
const modelLevels = computed(() => resolveModelInfo(props.catalog, model.value).levels)
const level = computed({
  get: () => preset.value?.thinkingLevel ?? "",
  set: (thinkingLevel: string) => {
    if (preset.value) preset.value = { ...preset.value, thinkingLevel }
  },
})
const { attachments, addFiles, remove, clear } = useChatInputAttachments()
// 附件不进协议，不能单独放行
const sendActive = computed(() => prompt.value.trim() !== "" && !props.sendDisabled)

const promptEditor = ref<{ focus: () => void } | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const usageOpen = ref(false)
const modelPickerOpen = ref(false)
const modelPickerActive = ref(false)
const {
  active: voiceActive,
  message: voiceMessage,
  start: startVoice,
  stop: stopVoice,
  cancel: cancelVoice,
} = useVoiceInput(prompt)
const showVoice = computed(() => prompt.value.trim() === "" && attachments.value.length === 0)
const primaryLabel = computed(() =>
  props.running
    ? "停止当前 Turn"
    : voiceActive.value
      ? "结束语音输入"
      : showVoice.value
        ? "语音输入，由浏览器识别"
        : "发送 Prompt",
)

watch(
  () => props.running,
  (running) => {
    if (running) cancelVoice()
  },
)

watch(
  () => [props.cwd, props.sessionId] as const,
  () => {
    usageOpen.value = false
    modelPickerOpen.value = false
    modelPickerActive.value = false
    voiceMessage.value = ""
    cancelVoice()
  },
)

function focusEditor() {
  promptEditor.value?.focus()
}

function removeAttachment(id: string) {
  remove(id)
  focusEditor()
}

function openFilePicker() {
  fileInput.value?.click()
}

function onFilesPicked(e: Event) {
  const input = e.target
  if (!(input instanceof HTMLInputElement)) return
  addFiles(input.files)
  input.value = ""
  focusEditor()
}

function onPaste(e: ClipboardEvent) {
  if (voiceActive.value) {
    e.preventDefault()
    return
  }
  const files = imageFilesFromClipboard(e.clipboardData)
  if (files.length === 0) return
  e.preventDefault()
  addFiles(files)
  focusEditor()
}

function send() {
  if (props.running || voiceActive.value || !sendActive.value) return
  const text = prompt.value
  emit("send", text)
  clear()
}

function onPrimaryAction() {
  if (props.running) {
    if (!props.aborting) emit("abort")
    return
  }
  if (voiceActive.value) {
    stopVoice()
    return
  }
  if (showVoice.value) {
    startVoice()
    return
  }
  send()
}
</script>

<style scoped>
.prompt {
  position: relative;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.prompt:not(.bare) {
  width: 100%;
  max-width: var(--size-chat-input);
  margin-inline: auto;
}
.error-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--size-icon-button);
  height: var(--size-icon-button);
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--danger);
  cursor: help;
}

.plus {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--size-icon-button);
  height: var(--size-icon-button);
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--ink-faint);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth),
    scale var(--duration-fast) var(--ease-out);
}
.plus:hover:not(:disabled) {
  background: var(--hover-tint);
  color: var(--ink);
}
.plus:disabled {
  opacity: 0.5;
  cursor: default;
}

.send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--size-icon-button);
  height: var(--size-icon-button);
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--inverse-bg);
  color: var(--inverse-fg);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth),
    opacity var(--duration-fast) var(--ease-smooth),
    scale var(--duration-fast) var(--ease-out);
}
.send:not(:disabled):hover {
  background: var(--inverse-bg-hover);
}
.send--abort,
.send--abort:not(:disabled):hover {
  background: var(--danger);
}
.send:disabled {
  cursor: default;
  opacity: 0.3;
  scale: 1;
}
.send--abort:disabled {
  opacity: 0.5;
}
.primary-icon {
  width: var(--size-icon);
  height: var(--size-icon);
}
@media (prefers-reduced-motion: reduce) {
  .plus,
  .send {
    transition: none;
  }
}
.plus:focus-visible,
.send:focus-visible,
.error-indicator:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.voice-status,
.voice-message {
  color: var(--ink-muted);
  font-size: var(--text-eyebrow);
}
.voice-message {
  margin: var(--spacing-xs) var(--spacing-sm);
}
.file-input {
  display: none;
}
</style>
