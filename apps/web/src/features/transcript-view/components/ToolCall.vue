<template>
  <div class="tool-summary" :class="{ failed, running }">
    <Button type="button" static class="summary" @click="toggleGroup">
      <component :is="icon" class="tool-icon" :stroke-width="1.5" data-icon="inline-start" />
      <span class="label">{{ label }}</span>
      <span
        v-if="detail"
        class="detail"
        :title="detail.kind === 'file' ? detail.path : detail.text"
      >
        <img v-if="detailIcon" class="file-icon" :src="detailIcon" alt="" />
        <span class="detail-text" :class="{ shimmer: running }">
          {{ detail.kind === "file" ? detail.name : detail.text }}
        </span>
      </span>
      <ChevronRight
        class="motion-turn motion-hint"
        :class="{ 'is-on': open }"
        :stroke-width="1.5"
        data-icon="inline-end"
      />
    </Button>
    <div class="tool-calls-group" :class="{ 'is-open': open, instant: !open }" :inert="!open">
      <div v-if="thought">
        <ToolStepCard
          v-if="thought.text"
          variant="thought"
          :text="thought.text"
          :streaming="thought.streaming"
        />
      </div>
      <div v-else :class="[{ direct: Boolean(directItem) }, 'body-inner']">
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
            :disabled="!call.expandable"
            @click="emit('toggle', { id: call.item.id, open: !call.itemOpen })"
          >
            <ChevronRight
              class="motion-turn caret"
              :class="{ 'is-on': call.itemOpen, invisible: !call.expandable }"
              :size="14"
            />
            <span class="kind">{{ call.kind }}</span>
            <span
              v-if="call.detail"
              class="detail"
              :title="call.detail.kind === 'file' ? call.detail.path : call.detail.text"
            >
              <img v-if="call.detailIcon" class="file-icon" :src="call.detailIcon" alt="" />
              <span
                class="detail-text"
                :class="{
                  'file-path': call.detail.kind === 'file',
                  shimmer: call.statusKind === 'is-run',
                }"
              >
                {{ call.detail.kind === "file" ? call.detail.name : call.detail.text }}
              </span>
            </span>
          </button>
          <div v-if="call.revealed && call.expandable" class="call-body">
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
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { getLanguageIcon, languageIconsRevision } from "markstream-vue"
import {
  ChevronRight,
  FileText,
  Lightbulb,
  Pencil,
  Search,
  SquareTerminal,
  Wrench,
} from "@lucide/vue"
import { Button } from "@components/ui/button/index.js"
import ToolStepCard from "@features/transcript-view/components/ToolStepCard.vue"
import {
  isCommandTool,
  toolCallKindLabel,
  toolCommand,
  toolInputPretty,
  toolPath,
  toolWorkingDirectory,
} from "@features/transcript-view/lib/transcript-format.js"
import {
  fileLanguage,
  readToolPreview,
  type ReadToolPreview,
} from "@features/transcript-view/lib/tool-presentation.js"
import {
  thoughtStepLabel,
  type ToolCallView,
  type ToolRowStep,
} from "@features/transcript-view/lib/transcript-rows.js"
import {
  toolDetail,
  toolSummary,
  toolSummaryDetail,
  type ToolSummaryDetail,
  directGroupItem,
} from "../lib/tool-summary.js"

const props = defineProps<{
  step: ToolRowStep
  isExpand: Map<string, boolean>
}>()
const emit = defineEmits<{ toggle: [value: { id: string; open: boolean }] }>()

const thought = computed(() => (props.step.type === "thought" ? props.step : null))
const group = computed(() => (props.step.type === "tools" ? props.step : null))
const directItem = computed(() => (group.value ? directGroupItem(group.value) : undefined))
const open = computed(
  () => thought.value?.streaming === true || props.isExpand.get(props.step.id) === true,
)
const failed = computed(() => group.value?.items.some((item) => item.isError) ?? false)
const running = computed(() =>
  thought.value
    ? thought.value.streaming
    : (group.value?.items.some((item) => item.running) ?? false),
)
const liveThoughtEndedAt = shallowRef<number>()
watch(
  () => thought.value?.streaming,
  (streaming, previous) => {
    if (streaming) liveThoughtEndedAt.value = undefined
    else if (previous) liveThoughtEndedAt.value = Date.now()
  },
  { flush: "sync" },
)
const label = computed(() => {
  if (thought.value) return thoughtStepLabel(thought.value, liveThoughtEndedAt.value)
  return toolSummary(group.value?.items ?? [])
})
const detail = computed(() => (group.value ? toolSummaryDetail(group.value.items) : null))
const detailIcon = computed(() => fileDetailIcon(detail.value))
const icon = computed(() => {
  if (thought.value) return Lightbulb
  switch (group.value?.key) {
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
  detail: ToolSummaryDetail | null
  detailIcon: string
  command: string
  path: string
  cwd: string
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
  const revealed = itemOpen
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
  const itemDetail = toolDetail(item.toolName, item.input)
  return {
    item,
    direct,
    itemOpen,
    revealed,
    statusKind: item.isError ? "is-err" : item.running ? "is-run" : "is-ok",
    commandStatus: item.isError ? "error" : item.running ? "running" : "success",
    statusLabel: item.isError ? "执行失败" : item.running ? "正在执行" : "执行完成",
    kind: toolCallKindLabel(item.toolName),
    detail: itemDetail,
    detailIcon: fileDetailIcon(itemDetail),
    command: toolCommand(item.input),
    path,
    cwd: toolWorkingDirectory(item.input),
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
  if (!group.value) return []
  const direct = directItem.value
  const items = direct ? [direct] : group.value.items
  return items.map((item) => {
    const itemOpen = direct ? open.value : open.value && props.isExpand.get(item.id) === true
    return presentCall(item, itemOpen, Boolean(direct))
  })
})

function fileDetailIcon(detail: ToolSummaryDetail | null): string {
  void languageIconsRevision.value
  if (detail?.kind !== "file") return ""
  const language = fileLanguage(detail.path)
  if (language === "text") return ""
  return `data:image/svg+xml;utf8,${encodeURIComponent(getLanguageIcon(language))}`
}

function toggleGroup() {
  emit("toggle", { id: props.step.id, open: !open.value })
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
  color: var(--on-primary);
}
.failed .tool-icon {
  color: var(--danger);
}
.tool-icon {
  position: relative;
  z-index: 1;
  background: var(--surface);
  transition: color var(--duration-fast) var(--ease-out);
}
.running .tool-icon {
  color: var(--primary);
}
.label {
  flex: none;
  max-width: 50%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.detail {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  flex: 0 1 auto;
  overflow: hidden;
  white-space: nowrap;
}
.file-icon {
  display: block;
  width: var(--size-icon);
  height: var(--size-icon);
  flex: none;
}
.detail-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.body-inner {
  padding-inline-start: var(--spacing-lg);
}
.body-inner.direct {
  padding-inline-start: 0;
}
.call {
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
.file-path {
  color: var(--ink-secondary);
  text-underline-offset: 3px;
}
.file-path:hover {
  color: var(--primary-active);
  text-decoration: underline;
}
.is-run .caret {
  color: var(--primary);
}
.call-body {
  min-width: 0;
  margin: var(--spacing-xxs) 0 var(--spacing-xs);
}
.direct .call-body {
  margin: 0;
}
</style>
