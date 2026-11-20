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

            <!-- 文件名点开 Files 面板，不展开行 -->
            <span
              v-if="target.text"
              class="tool-row-target"
              :class="{ 'is-openable': openable }"
              :title="target.path || target.text"
              @click="openable && openTarget($event)"
            >
              {{ target.text }}
            </span>

            <span v-if="readRange" class="tool-row-range">({{ readRange }})</span>
          </span>
        </RollText>

        <span v-if="lineChange.added || lineChange.removed" class="tool-row-counts">
          <span v-if="lineChange.added" class="added">+{{ lineChange.added }}</span>
          <span v-if="lineChange.removed" class="removed">-{{ lineChange.removed }}</span>
        </span>
      </button>

      <span v-if="images.length || duration" class="tool-row-meta">
        <ToolThumbs :images="images" />
        <span v-if="duration" class="tool-row-time">{{ duration }}</span>
      </span>

      <ChevronRightIcon class="tool-row-caret" :class="{ 'is-open': open }" data-icon="inline" />
    </div>

    <div v-if="open" class="tool-row-body">
      <ToolTaskBody v-if="tasks.length" :tasks="tasks" />
      <ToolCommandBody v-else-if="variant === 'command'" :call="shownCall" />

      <ToolFileBody
        v-else-if="variant === 'read' || variant === 'edit' || variant === 'search'"
        :call="shownCall"
      />

      <ToolGenericBody v-else :call="shownCall" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue"
import { ChevronRightIcon } from "@components/icons/index.js"
import { RollText } from "@components/ui/roll-text/index.js"
import ToolCommandBody from "@features/transcript-view/components/tool/ToolCommandBody.vue"
import ToolFileBody from "@features/transcript-view/components/tool/ToolFileBody.vue"
import ToolGenericBody from "@features/transcript-view/components/tool/ToolGenericBody.vue"
import ToolTaskBody from "@features/transcript-view/components/tool/ToolTaskBody.vue"
import ToolThumbs from "@features/transcript-view/components/tool/ToolThumbs.vue"
import {
  toolCallImages,
  toolCallLiveVerb,
  toolCallTarget,
  toolCallVariant,
  toolCallVerb,
} from "@features/transcript-view/lib/tool-run.js"
import {
  editDiffPreview,
  itemLineChange,
  readToolPreview,
} from "@features/transcript-view/lib/tool-summary.js"
import { openFileKey } from "@features/transcript-view/index.js"
import { toolTasks } from "@features/transcript-view/lib/tool-tasks.js"
import { formatElapsed } from "@utils/time.js"
import { useFullToolOutput } from "@features/transcript-view/hooks/use-full-tool-output.js"
import type { ToolCallView } from "@features/transcript-view/type.js"

const props = defineProps<{
  call: ToolCallView
  open: boolean
}>()
const emit = defineEmits<{ toggle: [open: boolean] }>()
const fullCall = useFullToolOutput(
  () => props.call,
  () => props.open,
)
const shownCall = computed(fullCall)
const tasks = computed(() => toolTasks(shownCall.value.details))
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
const readLines = computed(() => {
  // 读图片时输出只有一行占位说明，不是文件行
  if (variant.value !== "read" || props.call.running || props.call.isError) return undefined

  if (props.call.outputImages.length) return undefined

  const read = readToolPreview(props.call.input, props.call.outputText)

  if (read.lines.length === 0) return undefined
  return { line: read.startLine, endLine: read.startLine + read.lines.length - 1 }
})
const readRange = computed(() =>
  readLines.value ? `${readLines.value.line}-${readLines.value.endLine}` : "",
)
const fileOpener = inject(openFileKey, undefined)
const openable = computed(() => Boolean(fileOpener && target.value.path))

function openTarget(event: MouseEvent) {
  event.stopPropagation()
  const path = target.value.path

  if (!fileOpener || !path) return
  fileOpener.open({
    path,
    ...readLines.value,
    find: editDiffPreview(props.call.input)?.hunks[0]?.modified || undefined,
  })
}

const images = computed(() => toolCallImages(props.call))
</script>

<style scoped>
.tool-row {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* 触发器用伪元素铺满整行，缩略图浮在上面单独可点；箭头固定在最右 */
.tool-row-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  min-width: 0;
}

.tool-row-trigger {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: var(--space-2xs);
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--fg-secondary);
  font: inherit;
  font-size: var(--text-code);
  line-height: var(--text-meta--line-height);
  text-align: start;
  cursor: pointer;
}

.tool-row-trigger::after {
  content: "";
  position: absolute;
  inset: 0;
}

.tool-row-trigger:hover,
.tool-row-trigger:focus-visible,
.tool-row-trigger[aria-expanded="true"],
.tool-row-head:has(.tool-row-trigger:is(:hover, :focus-visible, [aria-expanded="true"]))
  .tool-row-caret {
  color: var(--fg-secondary);
}

.tool-row-text {
  flex: 0 1 auto;
  min-width: 0;
}

.tool-row-line {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
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
  color: var(--fg);
  font-weight: var(--font-weight-medium);
}

/* 与缩略图一样浮在整行伪元素之上，才点得到 */
.tool-row-target.is-openable {
  position: relative;
  z-index: var(--z-raise);
  cursor: pointer;
}

.tool-row-target.is-openable:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.tool-row-caret {
  flex: none;
  color: var(--fg-secondary);
  pointer-events: none;
  width: var(--icon-sm);
  height: var(--icon-sm);
  transition: transform var(--duration-fast) var(--ease-out);
}

/* 缩略图在左、计时在右，紧挨箭头；只有缩略图接收点击 */
.tool-row-meta {
  position: relative;
  z-index: var(--z-raise);
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-2xs);
  pointer-events: none;
}

.tool-row-time {
  flex: none;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.tool-row-range {
  flex: none;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
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
  gap: var(--space-2xs);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.tool-row-counts .added {
  padding: 0 var(--space-2xs);
  border-radius: calc(var(--radius-control) / 2);
  background: var(--success-subtle);
  color: var(--success-text);
}

.tool-row-counts .removed {
  padding: 0 var(--space-2xs);
  border-radius: calc(var(--radius-control) / 2);
  background: var(--danger-subtle);
  color: var(--danger-text);
}

.added {
  color: var(--success-text);
}

.removed {
  color: var(--danger-text);
}

.is-failed .tool-row-verb {
  color: var(--danger-text);
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
