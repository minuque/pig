<template>
  <form class="prompt" @submit.prevent="onSubmit">
    <Transition name="panel-reveal">
      <ContextUsagePanel
        v-if="usageOpen && usage"
        :usage="usage"
        :session-id="sessionId"
        @close="usageOpen = false"
      />
    </Transition>

    <Transition name="fade-layer">
      <QueuePanel
        v-if="queue.items.value.length"
        :items="queue.items.value"
        @reorder="queue.reorder"
        @edit="onQueueEdit"
        @send-now="emit('send-now', $event)"
        @remove="queue.remove"
      />
    </Transition>

    <PromptEditor
      ref="editor"
      v-model:prompt="prompt"
      :placeholder="placeholder"
      :resizing="contentResizing"
      :hero="hero"
      :cwd="cwd"
      @submit="onSubmit"
      @paste-files="attachments.addFiles"
    >
      <template v-if="attachmentFiles.length || attachmentError" #attachments>
        <div class="attach-tray">
          <p v-if="attachmentError" class="attach-error" role="alert">{{ attachmentError }}</p>

          <AttachmentChips
            :files="attachmentFiles"
            @remove="attachments.remove"
            @preview="onPreview"
          />
        </div>
      </template>

      <template #left>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              type="button"
              size="icon"
              class="attach press-scale"
              aria-label="添加附件"
              :disabled="attachmentsFull"
              @mousedown.prevent
              @click="pickFiles"
            >
              <Paperclip class="size-(--size-icon-2xs)" />
            </Button>
          </TooltipTrigger>

          <TooltipContent>添加附件</TooltipContent>
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

      <template #usage>
        <ContextUsageRing
          v-if="usage"
          :usage="usage"
          :open="usageOpen"
          @toggle="usageOpen = !usageOpen"
        />
      </template>

      <template #tools>
        <ModelPicker
          v-model:open="modelPickerOpen"
          v-model:model="model"
          v-model:level="level"
          :catalog="catalog"
        />
      </template>

      <template #right>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              type="button"
              size="icon"
              class="send press-scale"
              :class="{ 'send--abort': primaryMode === 'stop' }"
              :aria-label="primaryLabel"
              :aria-keyshortcuts="primaryMode === 'stop' ? 'Escape' : 'Enter'"
              :disabled="primaryDisabled"
              @mousedown.prevent
              @click="onPrimaryAction"
            >
              <span class="primary-icon icon-swap" aria-hidden="true">
                <span class="stop-square" :data-visible="primaryMode === 'stop'"></span>
                <ArrowUp :data-visible="primaryMode !== 'stop'" class="size-icon send-arrow" />
              </span>
            </Button>
          </TooltipTrigger>

          <TooltipContent>
            <!-- span 包住文案：两个元素间的换行空白会被编译器丢掉，间距只由 kbd 的 margin 决定 -->
            <span>{{ primaryLabel }}</span>
            <kbd v-if="primaryMode !== 'stop'" class="tooltip-hint">↵</kbd>
          </TooltipContent>
        </Tooltip>
      </template>
    </PromptEditor>

    <Transition name="stage-layer">
      <AttachmentLightbox
        v-if="previewItem"
        :url="previewItem.url"
        :name="previewItem.name"
        @close="previewItem = undefined"
      />
    </Transition>
  </form>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from "vue"
import { useEventListener } from "@vueuse/core"
import { ArrowUp, Paperclip } from "@lucide/vue"
import { Button } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import AttachmentChips from "@features/composer/components/AttachmentChips.vue"
import AttachmentLightbox from "@features/composer/components/AttachmentLightbox.vue"
import ContextUsageRing from "@features/composer/components/ContextUsageRing.vue"
import ModelPicker from "@features/composer/components/ModelPicker.vue"
import PromptEditor from "@features/composer/components/PromptEditor.vue"
import QueuePanel from "@features/composer/components/QueuePanel.vue"
import {
  MAX_COMPOSER_ATTACHMENTS,
  type ComposerAttachment,
  type ComposerAttachmentsApi,
} from "@features/composer/hooks/use-composer-attachments.js"
import type { ComposerQueueApi, QueuedPrompt } from "@features/composer/hooks/use-composer-queue.js"
import { PROMPT_PLACEHOLDER } from "@features/composer/index.js"
import type {
  ComposerModel,
  ComposerPreset,
  ComposerVendor,
  ContextUsage,
} from "@features/composer/type.js"

const ContextUsagePanel = defineAsyncComponent(
  () => import("@features/composer/components/ContextUsagePanel.vue"),
)
const props = withDefaults(
  defineProps<{
    catalog: ComposerVendor[]
    /** 附件状态由会话层持有，输入卡只消费 */
    attachments: ComposerAttachmentsApi
    /** 运行中：有文本入队，空白只能停止 */
    running?: boolean
    /** Abort 请求进行中：保持停止态并禁用重复点击 */
    aborting?: boolean
    /** 外部禁用发送（如 welcome 的 workspace/预设/提交中守卫） */
    sendDisabled?: boolean
    placeholder?: string
    usage?: ContextUsage | undefined
    sessionId?: string | undefined
    cwd?: string | undefined
    /** 对话列宽度手柄拖拽中，输入卡不折叠 */
    contentResizing?: boolean
    /** 新会话首屏：输入卡恒展开 */
    hero?: boolean
    queue: ComposerQueueApi
  }>(),
  {
    running: false,
    aborting: false,
    sendDisabled: false,
    placeholder: PROMPT_PLACEHOLDER,
    usage: undefined,
    sessionId: undefined,
    cwd: undefined,
    contentResizing: false,
    hero: false,
  },
)
const prompt = defineModel<string>("prompt", { required: true })
const preset = defineModel<ComposerPreset | undefined>("preset")
const emit = defineEmits<{
  send: [text: string]
  "send-now": [item: QueuedPrompt]
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
// 附件不单独发送：正文非空才允许提交，附件随这次提交一起走
const sendActive = computed(() => prompt.value.trim() !== "" && !props.sendDisabled)
const usageOpen = ref(false)
const modelPickerOpen = ref(false)
const previewItem = ref<ComposerAttachment>()
const fileInput = ref<HTMLInputElement | null>(null)
const editor = ref<InstanceType<typeof PromptEditor> | null>(null)
const attachmentFiles = computed(() => props.attachments.files.value)
const attachmentError = computed(() => props.attachments.error.value)
const attachmentsFull = computed(() => attachmentFiles.value.length >= MAX_COMPOSER_ATTACHMENTS)

/**
 * 主钮三态：idle+文本 Send / running+文本 Queue / running+空 Stop。
 * 空白时 Enter 永不打断，Stop 只留在按钮和 Esc。
 */
type PrimaryMode = "send" | "queue" | "stop"

const primaryMode = computed<PrimaryMode>(() => {
  if (props.running) return sendActive.value ? "queue" : "stop"
  return "send"
})
const primaryLabel = computed(() => {
  switch (primaryMode.value) {
    case "stop":
      return "停止当前 Turn"
    case "queue":
      return "加入待发队列"
    default:
      return "发送 Prompt"
  }
})
const primaryDisabled = computed(() => {
  if (primaryMode.value === "stop") return props.aborting
  return !sendActive.value
})

watch(
  () => props.sessionId,
  () => {
    usageOpen.value = false
    modelPickerOpen.value = false
  },
)

useEventListener(window, "keydown", onAbortHotkey, { capture: true })

/** 空闲发送；忙时有文本入队，空白不响应。Enter 走同一条路。 */
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

  // 附件快照回填输入卡暂存；占位直接移除，不做租约
  if (item.attachments) props.attachments.addFiles(item.attachments.files.map((f) => f.file))
  props.queue.remove(item.id)
  editor.value?.focus()
}

function pickFiles() {
  fileInput.value?.click()
}

/** 选完立刻清空，同一个文件能再次选。 */
function onFilesPicked(event: Event) {
  const input = event.target as HTMLInputElement

  props.attachments.addFiles(input.files)
  input.value = ""
}

function onPreview(item: ComposerAttachment) {
  previewItem.value = item
}

// 关掉灯箱把焦点还给输入框
watch(previewItem, (item, previous) => {
  if (previous && !item) editor.value?.focus()
})

function onAbortHotkey(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.isComposing) return

  if (event.altKey || event.ctrlKey || event.metaKey) return

  // 灯箱与菜单各自消费 Esc，不打断轮次
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
  gap: var(--spacing-xxs);
  width: 100%;
  min-width: 0;
}

.attach-error {
  margin: 0;
  color: var(--danger);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}

.attach {
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
  background: transparent;
  color: var(--ink-muted);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth);
}

.attach:not(:disabled):hover {
  background: var(--hover-quiet);
  color: var(--ink);
}

.attach:disabled {
  cursor: default;
  opacity: 0.3;
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
  color: var(--white);
}

.send:not(:disabled):hover {
  background: var(--primary-active);
}

/* 停止态：实心墨色圆 + 内部圆角方块，hover 只降不透明度 */
.send--abort,
.send--abort:not(:disabled):hover {
  background: var(--ink);
  color: var(--surface);
}

.send--abort:not(:disabled):hover {
  opacity: 0.85;
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
  margin-inline-start: var(--spacing-xxs);
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
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.attach:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
</style>
