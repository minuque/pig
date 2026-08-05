<template>
  <component
    :is="bare ? 'div' : 'form'"
    class="prompt"
    :class="{ bare, disabled: unavailable }"
    @submit.prevent="send"
  >
    <RunControlBar
      v-if="activeRun && !unavailable"
      :status="activeRun.status"
      :queued-count="queuedCount"
      :cancelling="cancelling.has(activeRun.id)"
      :steer-disabled="!hasText"
      @steer="steer"
      @cancel-run="emit('cancel-run', activeRun)"
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
          :disabled="unavailable"
          @files="onAttachmentFiles"
        />

        <slot name="left" />

        <ModelPicker v-model:model="model" :catalog="catalog" :disabled="unavailable" />
        <ThinkingLevelSelect v-model:level="level" :levels="modelLevels" :disabled="unavailable" />
      </template>
      <template #right>
        <button
          type="button"
          class="icon-btn send"
          :class="{ 'send-active': sendActive }"
          :aria-label="activeRun && !unavailable ? '排队发送' : '发送'"
          :title="activeRun && !unavailable ? '排队发送' : '发送'"
          :disabled="!sendActive"
          @click="send"
        >
          <ArrowUp :size="14" />
        </button>
      </template>
    </PromptEditor>

    <p v-if="unavailable" class="c-reason" role="status">
      Unavailable Session 拒绝新的 Run — 源无法安全恢复，可查看最后验证的信息。
    </p>
    <div v-if="runError" class="notice error" role="alert">{{ runError }}</div>
    <div v-if="activeRun" class="actions composer-actions">
      <span class="badge-preset mono"
        >{{ preset?.model ?? "—" }} · {{ preset?.thinkingLevel ?? "—" }}</span
      >
      <span class="c-note">{{
        unavailable
          ? "模型与 thinking level 在 admission 时冻结"
          : activeRun
            ? "Steer 纠偏当前 Run，不创建新 Run；发送则按 FIFO 排队"
            : "模型与 thinking level 在 admission 时冻结"
      }}</span>
    </div>
  </component>
</template>

<script lang="ts">
/** 发送守卫：有正文、非增强中、会话可用且未被外部禁用；与发送按钮 disabled 一致。 */
export function canSend(
  text: string,
  enhancing: boolean,
  unavailable: boolean,
  sendDisabled: boolean,
): boolean {
  return text.trim() !== "" && !enhancing && !unavailable && !sendDisabled;
}

/** Steer 守卫：有正文且会话可用。 */
export function canSteer(text: string, unavailable: boolean): boolean {
  return text.trim() !== "" && !unavailable;
}
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import { ArrowUp } from "lucide-vue-next";
import type { ModelPreset, ModelVendor } from "@no-pi-no-gang/contracts";
import ModelPicker from "../../components/composer/ModelPicker.vue";
import ThinkingLevelSelect from "../../components/composer/ThinkingLevelSelect.vue";
import { useModelPresetBinding } from "../../components/composer/model-preset.js";
import { useAttachments } from "../../components/composer/use-attachments.js";
import RunControlBar from "./RunControlBar.vue";
import PromptEditor from "./PromptEditor.vue";
import AttachmentMenu from "./AttachmentMenu.vue";
import AttachmentChips from "./AttachmentChips.vue";
import type { UiRun } from "./run-state.js";

const props = withDefaults(
  defineProps<{
    catalog: ModelVendor[];
    activeRun?: UiRun | undefined;
    queuedCount?: number;
    cancelling?: Set<string>;
    unavailable?: boolean;
    runError?: string;
    onEnhance?: ((prompt: string, signal?: AbortSignal) => Promise<string>) | undefined;
    /** 外部禁用发送（如 welcome 的 workspace/预设/提交中守卫） */
    sendDisabled?: boolean;
    placeholder?: string;
    ariaLabel?: string;
    /** 嵌入其他布局时以 div 渲染，避免嵌套 form */
    bare?: boolean;
  }>(),
  {
    queuedCount: 0,
    cancelling: () => new Set(),
    unavailable: false,
    runError: "",
    sendDisabled: false,
    placeholder: "Ask AI Agent",
    ariaLabel: "Ask AI Agent",
    bare: false,
  },
);

const prompt = defineModel<string>("prompt", { required: true });
const preset = defineModel<ModelPreset | undefined>("preset");

const emit = defineEmits<{
  send: [text: string];
  steer: [text: string];
  "cancel-run": [run: UiRun];
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

const hasText = computed(() => prompt.value.trim().length > 0);
const sendActive = computed(() =>
  canSend(prompt.value, enhancing.value, props.unavailable, props.sendDisabled),
);

// 文件选择后把焦点还给编辑器
function onAttachmentFiles(e: Event) {
  onFiles(e);
  nextTick(() => promptEditor.value?.focus());
}

function send() {
  if (!sendActive.value) return;
  const text = composeText(prompt.value);
  clearComposer();
  emit("send", text);
}
function steer() {
  if (!props.activeRun || !canSteer(prompt.value, props.unavailable)) return;
  const text = composeText(prompt.value);
  clearComposer();
  emit("steer", text);
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
.prompt.disabled {
  background: var(--canvas-soft);
}
.c-note {
  font-size: var(--text-caption);
  color: var(--ink-muted);
}
.c-reason {
  margin: var(--spacing-sm) 0;
  font-size: var(--text-caption);
  color: var(--danger);
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
