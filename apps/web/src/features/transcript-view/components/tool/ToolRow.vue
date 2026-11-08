<template>
  <div class="tool-row" :class="{ 'is-failed': call.isError, 'is-running': call.running }">
    <div class="tool-row-head">
      <button
        type="button"
        class="tool-row-trigger"
        :class="{ 'is-file': Boolean(target.path) }"
        :aria-expanded="open"
        @click="emit('toggle', !open)"
      >
        <RollText class="tool-row-text" :text="lineText">
          <span class="tool-row-line">
            <span
              class="tool-row-verb"
              :class="{ shimmer: Boolean(liveVerb) }"
              :data-text="liveVerb ?? undefined"
            >
              {{ shownVerb }}
            </span>

            <span v-if="target.text" class="tool-row-target" :title="target.path || target.text">
              {{ target.text }}
            </span>

            <span v-if="readRange" class="tool-row-range">({{ readRange }})</span>
          </span>
        </RollText>

        <span v-if="lineChange.added || lineChange.removed" class="tool-row-counts">
          <span v-if="lineChange.added" class="added">+{{ lineChange.added }}</span>
          <span v-if="lineChange.removed" class="removed">-{{ lineChange.removed }}</span>
        </span>

        <AltArrowRightIcon class="tool-row-caret" :class="{ 'is-open': open }" data-icon="inline" />
      </button>

      <span v-if="thumb || duration" class="tool-row-meta">
        <Tooltip v-if="thumb" :delay-duration="150">
          <TooltipTrigger as-child>
            <button
              type="button"
              class="tool-row-thumb"
              :aria-label="t('common.preview', { name: t('transcript.image') })"
              @click="previewOpen = true"
            >
              <img :src="thumb" alt="" />
            </button>
          </TooltipTrigger>

          <TooltipContent class="tool-thumb-tip" :side-offset="6">
            <img :src="thumb" alt="" />
          </TooltipContent>
        </Tooltip>

        <span v-if="duration" class="tool-row-time">{{ duration }}</span>
      </span>
    </div>

    <Dialog v-if="thumb" v-model:open="previewOpen">
      <DialogContent
        class="tool-thumb-dialog"
        :aria-label="t('common.preview', { name: t('transcript.image') })"
        :show-close-button="false"
        @click.self="previewOpen = false"
      >
        <img :src="thumb" alt="" class="tool-thumb-full" @click="previewOpen = false" />
      </DialogContent>
    </Dialog>

    <div v-if="open" class="tool-row-body">
      <ToolCommandBody v-if="variant === 'command'" :call="call" />

      <ToolFileBody
        v-else-if="variant === 'read' || variant === 'edit' || variant === 'search'"
        :call="call"
      />

      <ToolGenericBody v-else :call="call" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "@i18n/index.js"
import { AltArrowRightIcon } from "@components/icons/index.js"
import { Dialog, DialogContent } from "@components/ui/dialog/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import RollText from "@features/transcript-view/components/RollText.vue"
import ToolCommandBody from "@features/transcript-view/components/tool/ToolCommandBody.vue"
import ToolFileBody from "@features/transcript-view/components/tool/ToolFileBody.vue"
import ToolGenericBody from "@features/transcript-view/components/tool/ToolGenericBody.vue"
import {
  toolCallLiveVerb,
  toolCallTarget,
  toolCallVariant,
  toolCallVerb,
} from "@features/transcript-view/lib/tool-run.js"
import { itemLineChange, readToolPreview } from "@features/transcript-view/lib/tool-summary.js"
import { transcriptImageSrc } from "@features/transcript-view/lib/transcript-format.js"
import { formatElapsed } from "@utils/time.js"
import type { ToolCallView } from "@features/transcript-view/type.js"

const props = defineProps<{
  call: ToolCallView
  open: boolean
}>()
const emit = defineEmits<{ toggle: [open: boolean] }>()
const { t } = useI18n()
const previewOpen = ref(false)
const variant = computed(() => toolCallVariant(props.call))
const verb = computed(() => toolCallVerb(props.call))
const liveVerb = computed(() => (props.call.running ? toolCallLiveVerb(props.call) : null))
const shownVerb = computed(() => liveVerb.value ?? verb.value)
const target = computed(() => toolCallTarget(props.call))
const lineText = computed(() => [shownVerb.value, target.value.text].filter(Boolean).join(" "))
const lineChange = computed(() => itemLineChange(props.call.toolName, props.call.input))
const duration = computed(() => {
  const { startedAt, endedAt } = props.call

  if (startedAt === undefined || endedAt === undefined) return ""
  return formatElapsed(endedAt - startedAt)
})
const readRange = computed(() => {
  if (variant.value !== "read" || props.call.running || props.call.isError) return ""

  const read = readToolPreview(props.call.input, props.call.outputText)

  if (read.lines.length === 0) return ""
  return `${read.startLine}-${read.startLine + read.lines.length - 1}`
})
const thumb = computed(() => {
  const image = props.call.outputImages[0]
  return image ? transcriptImageSrc(image.data, image.mimeType) : null
})
</script>

<style scoped>
.tool-row {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* 触发器与缩略图分开：点缩略图不进展开，整行仍可点开 */
.tool-row-head {
  display: flex;
  align-items: center;
  gap: var(--space-xxs);
  min-width: 0;
}

.tool-row-trigger {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: var(--space-xxs);
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--contrast-foreground-faint);
  font: inherit;
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  text-align: start;
  cursor: pointer;
}

.tool-row-trigger:hover,
.tool-row-trigger:focus-visible,
.tool-row-trigger[aria-expanded="true"] {
  color: var(--contrast-foreground-secondary);
}

.tool-row-text {
  flex: 0 1 auto;
  min-width: 0;
}

.tool-row-line {
  display: flex;
  align-items: center;
  gap: var(--space-xxs);
  min-width: 0;
}

.tool-row-target {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-row-trigger.is-file .tool-row-target {
  color: var(--contrast-foreground);
  font-weight: var(--font-weight-medium);
}

.tool-row-caret {
  flex: none;
  width: var(--size-icon-xs);
  height: var(--size-icon-xs);
  transition: transform var(--duration-fast) var(--ease-out);
}

/* 缩略图在左、计时在右，统一靠右收尾 */
.tool-row-meta {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-xxs);
}

.tool-row-time {
  flex: none;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.tool-row-range {
  flex: none;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* 缩略图不超出所在行的行高，避免把单行工具行撑高 */
.tool-row-thumb {
  flex: none;
  height: calc(var(--text-meta) * var(--text-meta--line-height));
  aspect-ratio: 4 / 3;
  padding: 0;
  overflow: clip;
  border: 0;
  border-radius: calc(var(--radius-control) / 2);
  background: var(--background);
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
  cursor: zoom-in;
}

.tool-row-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tool-row-verb {
  flex: none;
  white-space: nowrap;
}

.tool-row-caret.is-open {
  transform: rotate(90deg);
}

.tool-row-counts {
  display: flex;
  flex: none;
  gap: var(--space-xxs);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.tool-row-counts .added {
  padding: 0 var(--space-xxs);
  border-radius: calc(var(--radius-control) / 2);
  background: var(--success-bg);
  color: var(--success);
}

.tool-row-counts .removed {
  padding: 0 var(--space-xxs);
  border-radius: calc(var(--radius-control) / 2);
  background: var(--danger-bg);
  color: var(--danger);
}

.added {
  color: var(--success);
}

.removed {
  color: var(--danger);
}

.is-failed .tool-row-verb {
  color: var(--danger);
}

.tool-row-body {
  min-width: 0;
  padding-block-start: var(--space-xs);
  font-size: var(--text-meta);
  line-height: var(--text-code-line);
}

@media (prefers-reduced-motion: reduce) {
  .tool-row-caret {
    transition: none;
  }
}
</style>

<style>
/* tooltip 内容经 portal 到 body，scoped 打不中 */
.tool-thumb-tip {
  padding: var(--space-xxs);
}

.tool-thumb-tip p {
  margin: 0;
}

.tool-thumb-tip img {
  display: block;
  max-inline-size: 280px;
  max-block-size: 280px;
  border-radius: var(--radius-control);
}

/* 大图预览与附件预览同款：铺满视口、点任意处关闭，图整体缩进窗口 */
.tool-thumb-dialog {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  max-inline-size: none;
  max-block-size: none;
  padding: var(--space-xl);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  cursor: zoom-out;
}

.tool-thumb-full {
  display: block;
  width: auto;
  height: auto;
  max-inline-size: 100%;
  max-block-size: calc(100vh - 2 * var(--space-xl));
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-modal);
}
</style>
