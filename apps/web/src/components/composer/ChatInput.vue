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
      v-model:prompt="prompt"
      :placeholder="placeholder"
      :aria-label="ariaLabel"
      @submit="send"
    >
      <template #left>
        <slot name="left" />

        <ModelPicker v-model:model="model" :catalog="catalog" :disabled="running" />
        <ThinkingLevelSelect v-model:level="level" :levels="modelLevels" :disabled="running" />
      </template>
      <template #right>
        <button
          type="button"
          class="icon-btn send"
          :class="{ 'send-active': sendActive }"
          :aria-label="running ? '发送 Steer' : '发送'"
          :title="running ? '发送 Steer（追加到当前 turn）' : '发送 Prompt'"
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
        >{{ modelLabel(preset?.model) }} · {{ preset?.thinkingLevel ?? "—" }}</span
      >
      <span class="c-note">{{
        running ? "运行中发送将作为 Steer 追加" : "Session 空闲时可修改模型与 thinking level"
      }}</span>
    </div>
  </component>
</template>

<script lang="ts">
/** 发送守卫：有正文且未被外部禁用；与发送按钮 disabled 一致。 */
export function canSend(text: string, sendDisabled: boolean): boolean {
  return text.trim() !== "" && !sendDisabled;
}
</script>

<script setup lang="ts">
import { computed } from "vue";
import { ArrowUp } from "lucide-vue-next";
import type { SessionPhase } from "@earendil-works/pi-protocol";
import ModelPicker from "@components/composer/ModelPicker.vue";
import ThinkingLevelSelect from "@components/composer/ThinkingLevelSelect.vue";
import PromptEditor from "@components/composer/PromptEditor.vue";
import { useModelPresetBinding } from "@components/composer/model-preset.js";
import {
  modelLabel,
  type ComposerPreset,
  type ComposerVendor,
} from "@components/composer/types.js";
import SessionControlBar from "@features/sessions/SessionControlBar.vue";

const props = withDefaults(
  defineProps<{
    catalog: ComposerVendor[];
    /** 当前 Session phase：非 idle 时显示控制栏 */
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
const running = computed(() => props.phase !== undefined && props.phase !== "idle");
const sendActive = computed(() => canSend(prompt.value, props.sendDisabled));

function send() {
  if (sendActive.value) emit("send", prompt.value);
}
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
