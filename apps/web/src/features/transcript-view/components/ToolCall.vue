<template>
  <div class="call" :class="statusKind">
    <button
      type="button"
      class="toggle"
      :class="{ open }"
      :aria-expanded="expandable ? open : undefined"
      :aria-controls="expandable ? bodyId : undefined"
      :disabled="!expandable"
      @click="open = !open"
    >
      <ChevronRight
        class="caret"
        :class="{ invisible: !expandable }"
        :size="14"
        aria-hidden="true"
      />
      <span class="kind">{{ kind }}</span>
      <span v-if="detail" class="separator" aria-hidden="true">·</span>
      <span v-if="detail" class="detail" :class="{ 'file-path': isFile }" :title="detail">{{
        detail
      }}</span>
      <span class="sr-only">{{ statusLabel }}</span>
    </button>
    <Transition name="fold-reveal">
      <div v-if="open && expandable" :id="bodyId" class="body">
        <div class="well">
          <ToolReadPreview v-if="readPreview" :path="path" :preview="readPreview" />
          <template v-else-if="isCommand && command">
            <ToolWellHeader label="命令" :text="command">
              <div class="command-heading">
                <span class="status-dot" :title="statusLabel" />
                <span v-if="cwd" class="cwd" :title="cwd">{{ pathBasename(cwd) }}</span>
                <code class="command" :title="command">{{ command }}</code>
              </div>
            </ToolWellHeader>
            <div class="output">
              <ExpandableText :text="outputText || emptyOutput" :show-count="false" embedded />
              <div v-if="outputImages.length" class="images">
                <TranscriptImage
                  v-for="(image, index) in outputImages"
                  :key="index"
                  :data="image.data"
                  :mime-type="image.mimeType"
                />
              </div>
            </div>
          </template>
          <template v-else>
            <section v-if="inputFull && !isRead" class="layer">
              <ToolWellHeader label="入参" :text="inputFull" shaded />
              <div class="output">
                <ExpandableText :text="inputFull" :show-count="false" embedded />
              </div>
            </section>
            <section class="layer">
              <ToolWellHeader :label="isRead ? path || 'Read' : '输出'" :text="outputText" shaded />
              <div class="output">
                <ExpandableText
                  v-if="outputText || !outputImages.length"
                  :text="outputText || emptyOutput"
                  :show-count="false"
                  embedded
                />
                <div v-if="outputImages.length" class="images">
                  <TranscriptImage
                    v-for="(image, index) in outputImages"
                    :key="index"
                    :data="image.data"
                    :mime-type="image.mimeType"
                  />
                </div>
              </div>
            </section>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from "vue"
import { ChevronRight } from "lucide-vue-next"
import ExpandableText from "@features/transcript-view/components/ExpandableText.vue"
import TranscriptImage from "@features/transcript-view/components/TranscriptImage.vue"
import ToolWellHeader from "@features/transcript-view/components/ToolWellHeader.vue"
import ToolReadPreview from "@features/transcript-view/components/ToolReadPreview.vue"
import {
  isCommandTool,
  toolCallDetail,
  toolCallKindLabel,
  toolCommand,
  toolInputPretty,
  toolPath,
  toolWorkingDirectory,
} from "@features/transcript-view/lib/transcript-format.js"
import { pathBasename, readToolPreview } from "@features/transcript-view/lib/tool-presentation.js"
import type { ToolCallView } from "@features/transcript-view/lib/transcript-rows.js"

const props = defineProps<{ item: ToolCallView }>()
const open = defineModel<boolean>("open", { required: true })
const bodyId = useId()
const toolName = computed(() => props.item.toolName.trim().toLowerCase())
const isRead = computed(() => toolName.value === "read")
const isFile = computed(() => ["read", "write", "edit"].includes(toolName.value))
const isCommand = computed(() => isCommandTool(toolName.value))
const statusKind = computed(() =>
  props.item.isError ? "is-err" : props.item.running ? "is-run" : "is-ok",
)
const statusLabel = computed(() =>
  props.item.isError ? "执行失败" : props.item.running ? "正在执行" : "执行完成",
)
const kind = computed(() => toolCallKindLabel(props.item.toolName))
const detail = computed(() => toolCallDetail(props.item.toolName, props.item.input))
const command = computed(() => toolCommand(props.item.input))
const path = computed(() => toolPath(props.item.input))
const cwd = computed(() => toolWorkingDirectory(props.item.input))
const inputFull = computed(() => (open.value ? toolInputPretty(props.item.input) : ""))
const outputText = computed(() => (open.value ? props.item.outputText : ""))
const outputImages = computed(() => (open.value ? props.item.outputImages : []))
const emptyOutput = computed(() => (props.item.running ? "(running…)" : "(no output)"))
const readPreview = computed(() => {
  if (
    !open.value ||
    !isRead.value ||
    !path.value ||
    props.item.isError ||
    props.item.running ||
    outputImages.value.length
  )
    return null
  if (!outputText.value || /^\[Line \d+ is .+ exceeds /.test(outputText.value)) return null
  return readToolPreview(props.item.input, outputText.value)
})
const expandable = computed(
  () =>
    props.item.running ||
    isRead.value ||
    isCommand.value ||
    toolInputPretty(props.item.input).length > 0 ||
    props.item.outputText.length > 0 ||
    props.item.outputImages.length > 0,
)
</script>

<style scoped>
.call {
  contain: layout style;
  min-width: 0;
}
.toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
  min-width: 0;
  min-height: 26px;
  padding: 2px 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--ink-muted);
  font-family: inherit;
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-regular);
  text-align: left;
}
.toggle:hover,
.toggle.open .kind {
  color: var(--ink-secondary);
}
.toggle:disabled {
  cursor: default;
  opacity: 1;
}
.toggle:not(:disabled):active {
  transform: none;
}
.toggle:focus-visible {
  outline: var(--focus-ring-width) solid var(--primary);
  outline-offset: var(--focus-ring-width);
}
.caret {
  flex: none;
  color: var(--ink-secondary);
  transition: transform var(--duration-fast) var(--ease-out);
}
.open .caret {
  transform: rotate(90deg);
}
.invisible {
  visibility: hidden;
}
.kind,
.separator {
  flex: none;
}
.separator {
  color: var(--ink-faint);
}
.detail {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-path {
  color: var(--ink-secondary);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.is-err .caret {
  color: var(--danger);
}
.is-run .caret {
  color: var(--primary);
}
.body {
  min-width: 0;
  margin: 4px 0 var(--spacing-xs);
}
.well {
  overflow: hidden;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-lg);
  background: var(--canvas-soft);
}
.command-heading {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
  font-family: var(--font-code);
}
.status-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--success);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--success) 15%, transparent);
}
.is-err .status-dot {
  background: var(--danger);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--danger) 15%, transparent);
}
.is-run .status-dot {
  background: var(--primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 15%, transparent);
  animation: status-pulse 1.2s ease-in-out infinite;
}
.cwd {
  flex: 0 1 auto;
  max-width: 16ch;
  overflow: hidden;
  color: var(--ink-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.command {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--ink);
  font: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.layer + .layer {
  border-top: var(--border-width) solid var(--hairline);
}
.output {
  min-width: 0;
  padding: var(--spacing-sm) 0 0 var(--spacing-sm);
}
.output :deep(.expand-text-pre) {
  color: var(--ink);
  font-family: var(--font-code);
  font-size: var(--text-caption);
}
.images {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-xs);
}
@keyframes status-pulse {
  50% {
    opacity: 0.4;
  }
}
@media (prefers-reduced-motion: reduce) {
  .caret {
    transition: none;
  }
  .status-dot {
    animation: none;
  }
}
</style>
