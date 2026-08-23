<template>
  <component
    :is="bare ? 'div' : 'form'"
    class="prompt"
    :class="{ bare, docked }"
    @submit.prevent="send"
    @paste="onPaste"
  >
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
          :aria-label="running ? '发送 Steer' : '发送'"
          :title="running ? '发送 Steer（追加到当前 turn）' : '发送 Prompt'"
          :disabled="!sendActive"
          @mousedown.prevent
          @click="send"
        >
          <ArrowUp :size="16" />
        </button>
      </template>
    </PromptEditor>
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

    <div v-if="running" class="chat-input-foot">
      <SessionControlBar
        v-if="phase && phase !== 'idle'"
        :phase="phase"
        :queued-steer-count="queuedSteerCount"
        :aborting="aborting"
        @abort="emit('abort')"
      />
    </div>
  </component>
</template>

<script lang="ts">
/** 发送守卫：有正文或附件，且未被外部禁用；与发送按钮 disabled 一致。 */
export function canSend(text: string, sendDisabled: boolean, attachmentCount = 0): boolean {
  return (text.trim() !== "" || attachmentCount > 0) && !sendDisabled;
}
</script>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowUp, CircleAlert, Plus } from "lucide-vue-next";
import type { SessionPhase } from "@earendil-works/pi-protocol";
import AttachmentThumb from "@features/chat-input/components/AttachmentThumb.vue";
import ModelPicker from "@features/chat-input/components/ModelPicker.vue";
import ThinkingLevelSelect from "@features/chat-input/components/ThinkingLevelSelect.vue";
import PromptEditor from "@features/chat-input/components/PromptEditor.vue";
import { useModelPresetBinding } from "@features/chat-input/hooks/use-model-preset-binding.js";
import {
  MAX_COMPOSER_ATTACHMENTS,
  imageFilesFromClipboard,
  useComposerAttachments,
} from "@features/chat-input/hooks/use-composer-attachments.js";
import type { ChatInputPreset, ChatInputVendor } from "@features/chat-input/types.js";
import SessionControlBar from "@features/session-workbench/components/SessionControlBar.vue";
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js";

const props = withDefaults(
  defineProps<{
    catalog: ChatInputVendor[];
    /** 当前 Session phase：非 idle 时在卡下显示轻提示 */
    phase?: SessionPhase | undefined;
    queuedSteerCount?: number;
    /** 取消中：禁用停止按钮并切换文案 */
    aborting?: boolean;
    error?: string;
    /** 外部禁用发送（如 welcome 的 workspace/预设/提交中守卫） */
    sendDisabled?: boolean;
    placeholder?: string;
    ariaLabel?: string;
    /** 嵌入其他布局时以 div 渲染，避免嵌套 form */
    bare?: boolean;
    /** 对话列贴底：宽度交给上层 dock */
    docked?: boolean;
  }>(),
  {
    phase: undefined,
    queuedSteerCount: 0,
    aborting: false,
    error: "",
    sendDisabled: false,
    placeholder: "给智能体发消息",
    ariaLabel: "给智能体发消息",
    bare: false,
    docked: false,
  },
);

const prompt = defineModel<string>("prompt", { required: true });
const preset = defineModel<ChatInputPreset | undefined>("preset");

const emit = defineEmits<{
  send: [text: string];
  abort: [];
}>();

const { model, modelLevels, level } = useModelPresetBinding(() => props.catalog, preset);
const running = computed(() => props.phase !== undefined && props.phase !== "idle");
const { attachments, addFiles, remove, clear } = useComposerAttachments();
const sendActive = computed(() =>
  canSend(prompt.value, props.sendDisabled, attachments.value.length),
);

const promptEditor = ref<{ focus: () => void } | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

function focusEditor() {
  promptEditor.value?.focus();
}

function openFilePicker() {
  fileInput.value?.click();
}

function onFilesPicked(e: Event) {
  const input = e.target as HTMLInputElement;
  addFiles(input.files);
  input.value = "";
  focusEditor();
}

function onPaste(e: ClipboardEvent) {
  const files = imageFilesFromClipboard(e.clipboardData);
  if (files.length === 0) return;
  e.preventDefault();
  addFiles(files);
  focusEditor();
}

function send() {
  if (!sendActive.value) return;
  const text = prompt.value;
  emit("send", text);
  if (text.trim() !== "") clear();
}
</script>

<style scoped>
.prompt {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.prompt:not(.bare):not(.docked) {
  width: min(var(--size-composer), 100%);
  margin-inline: auto;
}
.chat-input-foot {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  margin-top: 4px;
  padding-inline: 2px;
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
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth),
    transform var(--duration-fast) var(--ease-smooth);
}
.send:not(:disabled):hover {
  background: var(--primary-active);
}
.send:disabled {
  cursor: default;
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .plus,
  .send {
    transition: none;
  }
}
</style>
