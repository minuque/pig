<template>
  <component
    :is="bare ? 'div' : 'form'"
    class="prompt"
    :class="{ bare, docked }"
    @submit.prevent="send"
  >
    <PromptEditor
      v-model:prompt="prompt"
      :placeholder="placeholder"
      :aria-label="ariaLabel"
      @submit="send"
    >
      <template v-if="$slots.chips" #chips>
        <slot name="chips" />
      </template>
      <template #left>
        <slot name="left" />
      </template>
      <template #right>
        <ModelPicker v-model:model="model" :catalog="catalog" :disabled="running" />
        <ThinkingLevelSelect v-model:level="level" :levels="modelLevels" :disabled="running" />
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
          @click="send"
        >
          <ArrowUp :size="16" />
        </button>
      </template>
    </PromptEditor>

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
/** 发送守卫：有正文且未被外部禁用；与发送按钮 disabled 一致。 */
export function canSend(text: string, sendDisabled: boolean): boolean {
  return text.trim() !== "" && !sendDisabled;
}
</script>

<script setup lang="ts">
import { computed } from "vue";
import { ArrowUp, CircleAlert } from "lucide-vue-next";
import type { SessionPhase } from "@earendil-works/pi-protocol";
import ModelPicker from "@features/chat-input/components/ModelPicker.vue";
import ThinkingLevelSelect from "@features/chat-input/components/ThinkingLevelSelect.vue";
import PromptEditor from "@features/chat-input/components/PromptEditor.vue";
import { useModelPresetBinding } from "@features/chat-input/model-preset.js";
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
.prompt:not(.bare):not(.docked) {
  width: min(var(--size-content), 100%);
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
  background: color-mix(in srgb, var(--ink) 12%, transparent);
  color: var(--ink-faint);
  cursor: default;
  transition:
    background var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth),
    transform var(--duration-fast) var(--ease-smooth);
}
.send:not(:disabled) {
  background: var(--primary);
  color: var(--on-primary);
  cursor: pointer;
}
.send:not(:disabled):hover {
  background: var(--primary-active);
}
.send:disabled {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .send {
    transition: none;
  }
}
</style>
