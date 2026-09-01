<template>
  <div class="tool-summary" :class="{ failed }">
    <Button
      type="button"
      static
      class="summary"
      :aria-expanded="open"
      :aria-controls="bodyId"
      @click="toggleGroup"
    >
      <component
        :is="icon"
        class="tool-icon"
        :stroke-width="1.5"
        data-icon="inline-start"
        aria-hidden="true"
      />
      <span class="label">{{ label }}</span>
      <span v-if="detail" class="detail" :title="detail">{{ detail }}</span>
      <ChevronRight
        class="caret"
        :class="{ open }"
        :stroke-width="1.5"
        data-icon="inline-end"
        aria-hidden="true"
      />
    </Button>
    <div :id="bodyId" class="body" :class="{ open }" :inert="!open" :aria-hidden="!open">
      <div class="body-inner" :class="{ direct: Boolean(directItem) }">
        <div
          v-for="call in calls"
          :key="call.item.id"
          class="call"
          :class="[call.statusKind, { direct: call.direct }]"
        >
          <button
            v-if="!call.direct"
            type="button"
            class="toggle"
            :class="{ open: call.itemOpen }"
            :aria-expanded="call.expandable ? call.itemOpen : undefined"
            :aria-controls="call.expandable ? `${bodyId}-${call.item.id}` : undefined"
            :disabled="!call.expandable"
            @click="emit('toggle', { id: call.item.id, open: !call.itemOpen })"
          >
            <ChevronRight
              class="caret"
              :class="{ open: call.itemOpen, invisible: !call.expandable }"
              :size="14"
              aria-hidden="true"
            />
            <span class="kind">{{ call.kind }}</span>
            <span v-if="call.detail" class="separator" aria-hidden="true">·</span>
            <span
              v-if="call.detail"
              class="item-detail"
              :class="{ 'file-path': call.isFile }"
              :title="call.detail"
              >{{ call.detail }}</span
            >
            <span class="sr-only">{{ call.statusLabel }}</span>
          </button>
          <Transition name="fold-reveal">
            <div
              v-if="call.revealed && call.expandable"
              :id="`${bodyId}-${call.item.id}`"
              class="call-body"
            >
              <ToolStepCard
                v-if="call.isCommand && call.command"
                variant="command"
                :command="call.command"
                :cwd="call.cwd"
                :output-text="call.outputText"
                :output-images="call.outputImages"
                :empty-output="call.emptyOutput"
                :status="call.commandStatus"
                :status-label="call.statusLabel"
              />
              <ToolStepCard
                v-else-if="call.readPreview"
                variant="read"
                :path="call.path"
                :preview="call.readPreview"
              />
              <ToolStepCard
                v-else
                variant="tool"
                :input-full="call.isRead ? '' : call.inputFull"
                :output-text="call.outputText"
                :output-images="call.outputImages"
                :empty-output="call.emptyOutput"
                :output-label="call.isRead ? call.path || 'Read' : '输出'"
              />
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from "vue"
import { ChevronRight, FileText, Pencil, Search, SquareTerminal, Wrench } from "lucide-vue-next"
import { Button } from "@components/ui/button/index.js"
import ToolStepCard from "@features/transcript-view/components/ToolStepCard.vue"
import {
  isCommandTool,
  toolCallDetail,
  toolCallKindLabel,
  toolCommand,
  toolInputPretty,
  toolPath,
  toolWorkingDirectory,
} from "@features/transcript-view/lib/transcript-format.js"
import {
  readToolPreview,
  type ReadToolPreview,
} from "@features/transcript-view/lib/tool-presentation.js"
import type { ToolCallView, ToolGroup } from "@features/transcript-view/lib/transcript-rows.js"
import { directGroupItem, toolSummary, toolSummaryDetail } from "../lib/tool-summary.js"

const props = defineProps<{ group: ToolGroup; expanded: Map<string, boolean> }>()
const emit = defineEmits<{ toggle: [value: { id: string; open: boolean }] }>()
const bodyId = useId()
const directItem = computed(() => directGroupItem(props.group))
const open = computed(() => props.expanded.get(props.group.id) === true)
const failed = computed(() => props.group.items.some((item) => item.isError))
const label = computed(() => toolSummary(props.group.items))
const detail = computed(() => toolSummaryDetail(props.group.items))
const icon = computed(() => {
  switch (props.group.key) {
    case "read":
      return FileText
    case "edit":
      return Pencil
    case "search":
      return Search
    case "command":
      return SquareTerminal
    default:
      return Wrench
  }
})

type CallView = {
  item: ToolCallView
  direct: boolean
  itemOpen: boolean
  revealed: boolean
  statusKind: string
  commandStatus: "error" | "running" | "success"
  statusLabel: string
  kind: string
  detail: string
  command: string
  path: string
  cwd: string
  isFile: boolean
  isRead: boolean
  isCommand: boolean
  inputFull: string
  outputText: string
  outputImages: ToolCallView["outputImages"]
  emptyOutput: string
  readPreview: ReadToolPreview | null
  expandable: boolean
}

function presentCall(item: ToolCallView, itemOpen: boolean, direct: boolean): CallView {
  const toolName = item.toolName.trim().toLowerCase()
  const isRead = toolName === "read"
  const isCommand = isCommandTool(toolName)
  const revealed = direct || itemOpen
  const outputText = revealed ? item.outputText : ""
  const outputImages = revealed ? item.outputImages : []
  const path = toolPath(item.input)
  let readPreview: ReadToolPreview | null = null
  if (
    itemOpen &&
    isRead &&
    path &&
    !item.isError &&
    !item.running &&
    outputImages.length === 0 &&
    outputText &&
    !/^\[Line \d+ is .+ exceeds /.test(outputText)
  ) {
    readPreview = readToolPreview(item.input, outputText)
  }
  return {
    item,
    direct,
    itemOpen,
    revealed,
    statusKind: item.isError ? "is-err" : item.running ? "is-run" : "is-ok",
    commandStatus: item.isError ? "error" : item.running ? "running" : "success",
    statusLabel: item.isError ? "执行失败" : item.running ? "正在执行" : "执行完成",
    kind: toolCallKindLabel(item.toolName),
    detail: toolCallDetail(item.toolName, item.input),
    command: toolCommand(item.input),
    path,
    cwd: toolWorkingDirectory(item.input),
    isFile: ["read", "write", "edit"].includes(toolName),
    isRead,
    isCommand,
    inputFull: revealed ? toolInputPretty(item.input) : "",
    outputText,
    outputImages,
    emptyOutput: item.running ? "(running…)" : "(no output)",
    readPreview,
    expandable:
      item.running ||
      isRead ||
      isCommand ||
      toolInputPretty(item.input).length > 0 ||
      item.outputText.length > 0 ||
      item.outputImages.length > 0,
  }
}

const calls = computed(() => {
  const direct = directItem.value
  const items = direct ? [direct] : props.group.items
  return items.map((item) => {
    const itemOpen = direct ? true : open.value && props.expanded.get(item.id) === true
    return presentCall(item, itemOpen, Boolean(direct))
  })
})

function toggleGroup() {
  emit("toggle", { id: props.group.id, open: !open.value })
}
</script>

<style scoped>
.tool-summary {
  min-width: 0;
}
.summary {
  width: 100%;
  height: auto;
  min-height: 28px;
  min-width: 0;
  padding: 2px 0;
  gap: var(--spacing-xs);
  justify-content: flex-start;
  border-radius: 0;
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-regular);
  text-align: start;
}
.summary:hover {
  background: transparent;
  color: var(--ink-secondary);
}
.failed .tool-icon {
  color: var(--danger);
}
.label {
  flex: none;
  max-width: 50%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.detail {
  min-width: 0;
  flex: 0 1 auto;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.caret {
  transition: transform var(--duration-fast) var(--ease-out);
}
.caret.open {
  transform: rotate(90deg);
}
.body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--duration-fast) var(--ease-out);
}
.body.open {
  grid-template-rows: 1fr;
  transition-duration: var(--duration-slow);
}
.body-inner {
  min-height: 0;
  overflow: hidden;
  padding-inline-start: var(--spacing-lg);
}
.body-inner.direct {
  padding-inline-start: 0;
}
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
.toggle .caret {
  flex: none;
  color: var(--ink-secondary);
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
.item-detail {
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
.is-run .caret {
  color: var(--primary);
}
.call-body {
  min-width: 0;
  margin: 4px 0 var(--spacing-xs);
}
.direct .call-body {
  margin: 0;
}
@media (prefers-reduced-motion: reduce) {
  .body,
  .caret {
    transition: none;
  }
}
</style>
