<template>
  <form class="prompt" @submit.prevent="send">
    <Transition name="panel-reveal">
      <ContextUsagePanel
        v-if="usageOpen && usage"
        :usage="usage"
        :session-id="sessionId"
        @close="usageOpen = false"
      />
    </Transition>

    <PromptEditor
      v-model:prompt="prompt"
      :placeholder="placeholder"
      :readonly="voiceActive"
      @submit="send"
    >
      <template #left>
        <template v-if="!voiceActive">
          <ModelPicker
            v-model:open="modelPickerOpen"
            v-model:model="model"
            v-model:level="level"
            :catalog="catalog"
            :disabled="running || voiceActive"
          />
        </template>
      </template>

      <template #right>
        <span v-if="voiceActive" class="voice-status" role="status">正在聆听…</span>

        <Button
          type="button"
          size="icon"
          class="send press-scale"
          :class="{ 'send--abort': running || voiceActive, 'motion-pulse': voiceActive }"
          :title="primaryLabel"
          :aria-label="primaryLabel"
          :aria-keyshortcuts="running ? 'Escape' : undefined"
          :disabled="running ? aborting : !voiceActive && !showVoice && !sendActive"
          @mousedown.prevent
          @click="onPrimaryAction"
        >
          <span class="primary-icon icon-swap" aria-hidden="true">
            <span class="send-esc" :data-visible="running">Esc</span>

            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="currentColor"
              :data-visible="!running && voiceActive"
            >
              <rect x="2" y="2" width="8" height="8" rx="1.5" />
            </svg>

            <ArrowUp :data-visible="!running && !voiceActive && !showVoice" class="size-icon" />
            <Mic :data-visible="!running && !voiceActive && showVoice" class="size-icon" />
          </span>
        </Button>
      </template>

      <template #meta>
        <ComposerMeta
          :cwd="cwd"
          :usage="usage"
          :open="usageOpen"
          @toggle="usageOpen = !usageOpen"
        />
      </template>
    </PromptEditor>

    <p v-if="voiceMessage" class="voice-message" role="status">{{ voiceMessage }}</p>
  </form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { useEventListener } from "@vueuse/core"
import { ArrowUp, Mic } from "@lucide/vue"
import { Button } from "@components/ui/button/index.js"
import { useVoiceInput } from "@features/composer/hooks/use-voice-input.js"
import ComposerMeta from "@features/composer/components/ComposerMeta.vue"
import ContextUsagePanel from "@features/composer/components/ContextUsagePanel.vue"
import ModelPicker from "@features/composer/components/ModelPicker.vue"
import PromptEditor from "@features/composer/components/PromptEditor.vue"
import type { ComposerModel, ComposerPreset, ComposerVendor } from "@/types/composer-type.js"
import type { ContextUsage } from "@features/composer/type.js"

const props = withDefaults(
  defineProps<{
    catalog: ComposerVendor[]
    /** 运行中把发送钮改成停止 */
    running?: boolean
    /** Abort 请求进行中：保持停止态并禁用重复点击 */
    aborting?: boolean
    /** 外部禁用发送（如 welcome 的 workspace/预设/提交中守卫） */
    sendDisabled?: boolean
    placeholder?: string
    /** 当前工作目录，底栏展示末段名 */
    cwd?: string | undefined
    usage?: ContextUsage | undefined
    sessionId?: string | undefined
  }>(),
  {
    running: false,
    aborting: false,
    sendDisabled: false,
    placeholder: "do what you want ...",
    cwd: undefined,
    usage: undefined,
    sessionId: undefined,
  },
)

const prompt = defineModel<string>("prompt", { required: true })

const preset = defineModel<ComposerPreset | undefined>("preset")

const emit = defineEmits<{
  send: [text: string]
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

// 图片未进协议，不露出附件入口
const sendActive = computed(() => prompt.value.trim() !== "" && !props.sendDisabled)

const usageOpen = ref(false)

const modelPickerOpen = ref(false)

const {
  active: voiceActive,
  message: voiceMessage,
  start: startVoice,
  stop: stopVoice,
  cancel: cancelVoice,
} = useVoiceInput(prompt)

const showVoice = computed(() => prompt.value.trim() === "")

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
    voiceMessage.value = ""
    cancelVoice()
  },
)

useEventListener(window, "keydown", onAbortHotkey, { capture: true })

function send() {
  if (props.running || voiceActive.value || !sendActive.value) return
  emit("send", prompt.value)
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

function onAbortHotkey(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.isComposing) return

  if (event.altKey || event.ctrlKey || event.metaKey) return

  if (!props.running || props.aborting || modelPickerOpen.value) return
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
  width: 100%;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--size-icon-button);
  height: var(--size-icon-button);
  min-width: var(--size-icon-button);
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth),
    opacity var(--duration-fast) var(--ease-smooth),
    scale var(--duration-fast) var(--ease-out);
  background: var(--primary);
  color: var(--on-primary);
}

.send:not(:disabled):hover {
  background: var(--primary-active);
}

.send--abort,
.send--abort:not(:disabled):hover {
  background: var(--danger);
  color: var(--danger-foreground);
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
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.send-esc {
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  letter-spacing: 0;
}

@media (prefers-reduced-motion: reduce) {
  .send {
    transition: none;
  }
}

.send:focus-visible {
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
</style>
