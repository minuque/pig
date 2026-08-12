<template>
  <component :is="bare ? 'div' : 'form'" class="prompt" :class="{ bare }" @submit.prevent="send">
    <SessionControlBar
      v-if="phase && phase !== 'idle'"
      :phase="phase"
      :queued-steer-count="queuedSteerCount"
      :aborting="aborting"
      @abort="emit('abort')"
    />

    <PromptEditor
      ref="promptEditor"
      v-model:prompt="prompt"
      v-model:enhancing="enhancing"
      :on-enhance="onEnhance"
      :placeholder="placeholder"
      :aria-label="ariaLabel"
      @submit="send"
    >
      <template #chips>
        <AttachmentChips
          :attachments="attachments"
          :exiting="exitingAtt"
          @remove="removeAttachment"
        />
      </template>
      <template #left>
        <AttachmentMenu
          v-model:menu-open="menuOpen"
          :disabled="sendDisabled"
          @files="onAttachmentFiles"
        />

        <slot name="left" />

        <ModelPicker v-model:model="model" :catalog="catalog" />
        <ThinkingLevelSelect v-model:level="level" :levels="modelLevels" :disabled="running" />
      </template>
      <template #right>
        <button
          type="button"
          class="icon-btn send"
          :class="{ 'send-active': sendActive }"
          :aria-label="running ? '发送 Steer' : '发送'"
          :title="running ? '发送 Steer（运行中不创建新 Run）' : '发送'"
          :disabled="!sendActive"
          @click="send"
        >
          <ArrowUp :size="14" />
        </button>
      </template>
    </PromptEditor>

    <div v-if="error" class="notice error" role="alert">{{ error }}</div>
    <div v-if="phase" class="actions composer-actions">
      <span class="badge-preset mono"
        >{{ preset?.model ?? "—" }} · {{ preset?.thinkingLevel ?? "—" }}</span
      >
      <span class="c-note">{{
        running ? "运行中发送将作为 Steer 追加，不创建新 Run" : "模型与 thinking level 在创建时固定"
      }}</span>
    </div>
  </component>
</template>

<script lang="ts">
/** 发送守卫：有正文、非增强中且未被外部禁用；与发送按钮 disabled 一致。 */
export function canSend(text: string, enhancing: boolean, sendDisabled: boolean): boolean {
  return text.trim() !== "" && !enhancing && !sendDisabled;
}
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ArrowUp } from "lucide-vue-next";
import type { SessionPhase } from "@earendil-works/pi-protocol";
import ModelPicker from "./ModelPicker.vue";
import ThinkingLevelSelect from "./ThinkingLevelSelect.vue";
import PromptEditor from "./PromptEditor.vue";
import AttachmentMenu from "./AttachmentMenu.vue";
import AttachmentChips from "./AttachmentChips.vue";
import { useModelPresetBinding } from "./model-preset.js";
import { useAttachments } from "./use-attachments.js";
import type { ComposerPreset, ComposerVendor } from "./types.js";
import SessionControlBar from "../../features/sessions/SessionControlBar.vue";

const props = withDefaults(
  defineProps<{
    catalog: ComposerVendor[];
    /** 当前 Session phase：非 idle 时显示控制栏 */
    phase?: SessionPhase | undefined;
    queuedSteerCount?: number;
    /** 取消中：禁用停止按钮并切换文案 */
    aborting?: boolean;
    error?: string;
    onEnhance?: ((prompt: string, signal?: AbortSignal) => Promise<string>) | undefined;
    /** 外部禁用发送（如 welcome 的 workspace/预设/提交中守卫） */
    sendDisabled?: boolean;
    placeholder?: string;
    ariaLabel?: string;
    /** 嵌入其他布局时以 div 渲染，避免嵌套 form */
    bare?: boolean;
  }>(),
  {
    phase: undefined,
    queuedSteerCount: 0,
    aborting: false,
    error: "",
    sendDisabled: false,
    placeholder: "Ask AI Agent",
    ariaLabel: "Ask AI Agent",
    bare: false,
  },
);

const prompt = defineModel<string>("prompt", { required: true });
const preset = defineModel<ComposerPreset | undefined>("preset");

const emit = defineEmits<{
  send: [text: string];
  abort: [];
}>();

const { model, modelLevels, level } = useModelPresetBinding(() => props.catalog, preset);
const {
  attachments,
  exitingAtt,
  menuOpen,
  onFiles,
  removeAttachment,
  composeText,
  clear,
  dispose,
} = useAttachments();

/** 编辑器增强中：由 PromptEditor 单向写入，用于禁用发送 */
const enhancing = ref(false);
const promptEditor = ref<InstanceType<typeof PromptEditor> | null>(null);

const running = computed(() => props.phase !== undefined && props.phase !== "idle");
const sendActive = computed(() => canSend(prompt.value, enhancing.value, props.sendDisabled));

// 文件选择后把焦点还给编辑器
function onAttachmentFiles(e: Event) {
  onFiles(e);
  nextTick(() => promptEditor.value?.focus());
}

// 发送后父组件（发送成功）清空 prompt：此时清附件并复位发送标记；
// 发送失败则 prompt 原样保留（正文与附件都不丢），无需恢复逻辑。
let sentNonEmpty = false;
watch(prompt, (value) => {
  if (value === "" && sentNonEmpty) {
    sentNonEmpty = false;
    clearComposer();
  }
});

function send() {
  if (!sendActive.value) return;
  sentNonEmpty = true;
  // 不清空：清空由父组件在提交成功后触发（prompt 置空）
  emit("send", composeText(prompt.value));
}
function clearComposer() {
  // 清空 prompt 由 PromptEditor 的 watch 同步编辑器并复位增强状态
  prompt.value = "";
  clear();
  nextTick(() => promptEditor.value?.focus());
}

onBeforeUnmount(dispose);
</script>

<style scoped>
.prompt {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.prompt:not(.bare) {
  width: min(var(--size-content), 100%);
  margin: auto;
}
.c-note {
  font-size: var(--text-caption);
  color: var(--ink-muted);
}
.composer-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  margin-top: var(--spacing-xs);
}
.badge-preset {
  font-size: var(--text-caption);
  color: var(--ink-secondary);
}
.notice {
  padding: var(--spacing-md);
  background: var(--canvas-soft);
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-md);
}
.error {
  border-left: var(--border-width-emphasis) solid var(--danger);
  margin-top: var(--spacing-sm);
}

.icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex: none;
  border: 0;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
}
.icon-btn::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  transition:
    background 150ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
.icon-btn:hover:not(:disabled)::before {
  background: color-mix(in srgb, var(--ink) 10%, transparent);
}
.icon-btn:active:not(:disabled)::before {
  transform: scale(0.98);
}
.icon-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.icon-btn > svg {
  position: relative;
}

.send {
  color: var(--ink-faint);
}
.send:disabled {
  cursor: default;
}
.send:disabled:active::before {
  transform: none;
}
.send-active {
  color: var(--inverse-fg);
}
.send-active::before {
  background: var(--inverse-bg);
}
.send-active:hover:not(:disabled)::before {
  background: var(--inverse-bg-hover);
}
@media (prefers-reduced-motion: reduce) {
  .icon-btn::before {
    transition: none;
  }
}
</style>
