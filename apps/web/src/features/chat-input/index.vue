<template>
  <component
    :is="bare ? 'div' : 'form'"
    class="prompt"
    :class="{ bare }"
    @submit.prevent="send"
    @paste="onPaste"
  >
    <ContextUsagePanel
      v-if="usageOpen && usage"
      :usage="usage"
      :session-id="sessionId"
      @close="usageOpen = false"
    />
    <PromptEditor
      ref="promptEditor"
      v-model:prompt="prompt"
      :placeholder="placeholder"
      :aria-label="ariaLabel"
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
          class="plus"
          aria-label="添加图片"
          :disabled="attachments.length >= MAX_COMPOSER_ATTACHMENTS"
          @mousedown.prevent
          @click="openFilePicker"
        >
          <Plus :size="16" />
        </button>
        <Tooltip v-if="error" :delay-duration="200">
          <TooltipTrigger as-child>
            <button type="button" class="error-indicator" aria-label="请求失败">
              <CircleAlert :size="16" />
            </button>
          </TooltipTrigger>
          <TooltipContent class="max-w-[360px]">{{ error }}</TooltipContent>
        </Tooltip>
        <button
          type="button"
          class="send"
          :class="{ 'send--abort': running }"
          :aria-label="running ? (aborting ? '正在停止当前 Turn' : '停止当前 Turn') : '发送'"
          :title="running ? '停止当前 Turn' : '发送 Prompt'"
          :disabled="running ? aborting : !sendActive"
          @mousedown.prevent
          @click="onPrimaryAction"
        >
          <svg
            v-if="running"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect x="2" y="2" width="8" height="8" rx="1.5" />
          </svg>
          <ArrowUp v-else :size="16" />
        </button>
      </template>
    </PromptEditor>
    <ComposerMeta
      v-if="showMeta"
      :cwd="cwd"
      :usage="usage"
      :open="usageOpen"
      @toggle="usageOpen = !usageOpen"
    />
    <input
      ref="fileInput"
      type="file"
      class="sr-only"
      accept="image/*"
      multiple
      tabindex="-1"
      aria-hidden="true"
      @change="onFilesPicked"
    />
  </component>
</template>

<script lang="ts">
/** 发送守卫：有正文且未被外部禁用；附件不进协议，不能单独放行。 */
export function canSend(text: string, sendDisabled: boolean): boolean {
  return text.trim() !== "" && !sendDisabled
}
</script>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { ArrowUp, CircleAlert, Plus } from "lucide-vue-next"
import type { ModelRef } from "@earendil-works/pi-protocol"
import AttachmentThumb from "@features/chat-input/components/AttachmentThumb.vue"
import ComposerMeta from "@features/chat-input/components/ComposerMeta.vue"
import ContextUsagePanel from "@features/chat-input/components/ContextUsagePanel.vue"
import ModelPicker from "@features/chat-input/components/ModelPicker.vue"
import ThinkingLevelSelect from "@features/chat-input/components/ThinkingLevelSelect.vue"
import PromptEditor from "@features/chat-input/components/PromptEditor.vue"
import {
  shouldShowComposerMeta,
  type ContextUsage,
} from "@features/chat-input/lib/context-usage.js"
import { resolveModelInfo } from "@features/chat-input/lib/model-preset.js"
import {
  MAX_COMPOSER_ATTACHMENTS,
  imageFilesFromClipboard,
  useComposerAttachments,
} from "@features/chat-input/hooks/use-composer-attachments.js"
import type { ChatInputPreset, ChatInputVendor } from "@features/chat-input/types.js"
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
    ariaLabel?: string
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
    ariaLabel: "do what you want ...",
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
  set: (next: ModelRef | undefined) => {
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
const { attachments, addFiles, remove, clear } = useComposerAttachments()
const sendActive = computed(() => canSend(prompt.value, props.sendDisabled))

const promptEditor = ref<{ focus: () => void } | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const usageOpen = ref(false)
const showMeta = computed(() => shouldShowComposerMeta(props.cwd, props.usage))

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
  width: min(var(--size-composer), 100%);
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
    color var(--duration-fast) var(--ease-smooth);
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
  background: var(--primary);
  color: var(--on-primary);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--on-primary) 16%, transparent),
    0 1px 2px color-mix(in srgb, var(--primary) 24%, transparent);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-smooth),
    box-shadow var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth),
    opacity var(--duration-fast) var(--ease-smooth),
    transform var(--duration-fast) var(--ease-smooth);
}
.send:not(:disabled):hover {
  background: var(--primary-active);
  transform: scale(1.05);
}
.send:active {
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
  transform: none;
}
.send--abort:disabled {
  opacity: 0.5;
}
@media (prefers-reduced-motion: reduce) {
  .plus,
  .send {
    transition: none;
  }
}
</style>
