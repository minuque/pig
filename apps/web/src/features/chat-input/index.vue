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
      @submit="send"
    >
      <template v-if="attachments.length || $slots.chips" #chips>
        <AttachmentThumb
          v-for="item in attachments"
          :key="item.id"
          :src="item.url"
          :name="item.name"
          @remove="remove(item.id)"
        />
        <slot name="chips" />
      </template>
      <template #left>
        <slot name="left" />
        <ModelPicker v-model:model="model" :catalog="catalog" :disabled="running" />
        <ThinkingLevelSelect
          v-if="modelLevels.length > 1"
          v-model:level="level"
          :levels="modelLevels"
          :disabled="running"
        />
      </template>
      <template #right>
        <button
          type="button"
          class="plus press-scale"
          :disabled="attachments.length >= MAX_CHAT_INPUT_ATTACHMENTS"
          @mousedown.prevent
          @click="openFilePicker"
        >
          <Plus :size="16" />
        </button>
        <Tooltip v-if="error" :delay-duration="200">
          <TooltipTrigger as-child>
            <button type="button" class="error-indicator">
              <CircleAlert :size="16" />
            </button>
          </TooltipTrigger>
          <TooltipContent class="max-w-[360px]">{{ error }}</TooltipContent>
        </Tooltip>
        <button
          type="button"
          class="send press-scale"
          :class="{ 'send--abort': running }"
          :title="running ? '停止当前 Turn' : '发送 Prompt'"
          :disabled="running ? aborting : !sendActive"
          @mousedown.prevent
          @click="onPrimaryAction"
        >
          <span class="primary-icon icon-swap">
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="currentColor"
              :data-visible="running"
            >
              <rect x="2" y="2" width="8" height="8" rx="1.5" />
            </svg>
            <ArrowUp :size="16" :data-visible="!running" />
          </span>
        </button>
      </template>
    </PromptEditor>
    <ChatInputMeta
      v-if="showMeta"
      :cwd="cwd"
      :usage="usage"
      :open="usageOpen"
      @toggle="usageOpen = !usageOpen"
    />
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
import { ArrowUp, CircleAlert, Plus } from "lucide-vue-next"
import AttachmentThumb from "@features/chat-input/components/AttachmentThumb.vue"
import ChatInputMeta from "@features/chat-input/components/ChatInputMeta.vue"
import ContextUsagePanel from "@features/chat-input/components/ContextUsagePanel.vue"
import ModelPicker from "@features/chat-input/components/ModelPicker.vue"
import ThinkingLevelSelect from "@features/chat-input/components/ThinkingLevelSelect.vue"
import PromptEditor from "@features/chat-input/components/PromptEditor.vue"
import {
  shouldShowChatInputMeta,
  type ContextUsage,
} from "@features/chat-input/lib/context-usage.js"
import { resolveModelInfo } from "@features/chat-input/lib/model-preset.js"
import {
  MAX_CHAT_INPUT_ATTACHMENTS,
  imageFilesFromClipboard,
  useChatInputAttachments,
} from "@features/chat-input/hooks/use-chat-input-attachments.js"
import type {
  ChatInputModel,
  ChatInputPreset,
  ChatInputVendor,
} from "@features/chat-input/types.js"
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
const showMeta = computed(() => shouldShowChatInputMeta(props.cwd, props.usage))

watch(
  () => [props.cwd, props.sessionId] as const,
  () => {
    usageOpen.value = false
  },
)

function focusEditor() {
  promptEditor.value?.focus()
}

function openFilePicker() {
  fileInput.value?.click()
}

function onFilesPicked(e: Event) {
  const input = e.target as HTMLInputElement
  addFiles(input.files)
  input.value = ""
  focusEditor()
}

function onPaste(e: ClipboardEvent) {
  const files = imageFilesFromClipboard(e.clipboardData)
  if (files.length === 0) return
  e.preventDefault()
  addFiles(files)
  focusEditor()
}

function send() {
  if (props.running || !sendActive.value) return
  const text = prompt.value
  emit("send", text)
  clear()
}

function onPrimaryAction() {
  if (props.running) {
    emit("abort")
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
  width: 28px;
  height: 28px;
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
  width: 28px;
  height: 28px;
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
  background: color-mix(in srgb, var(--ink) 8%, transparent);
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
  width: 28px;
  height: 28px;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--inverse-bg);
  color: var(--inverse-fg);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--inverse-fg) 16%, transparent),
    0 1px 2px color-mix(in srgb, var(--inverse-bg) 24%, transparent);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-smooth),
    box-shadow var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth),
    opacity var(--duration-fast) var(--ease-smooth),
    scale var(--duration-fast) var(--ease-out);
}
.send:not(:disabled):hover {
  background: var(--inverse-bg-hover);
}
.send:not(:disabled):active {
  box-shadow: none;
}
.send--abort {
  background: color-mix(in srgb, var(--danger) 90%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--on-primary) 16%, transparent),
    0 1px 2px color-mix(in srgb, var(--danger) 24%, transparent);
}
.send--abort:not(:disabled):hover {
  background: var(--danger);
}
.send:disabled {
  cursor: default;
  opacity: 0.3;
  box-shadow: none;
  scale: 1;
}
.send--abort:disabled {
  opacity: 0.5;
}
.primary-icon {
  width: 16px;
  height: 16px;
}
@media (prefers-reduced-motion: reduce) {
  .plus,
  .send {
    transition: none;
  }
}
.file-input {
  display: none;
}
</style>
