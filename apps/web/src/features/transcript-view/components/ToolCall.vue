<template>
  <div class="tool-summary" :class="{ failed, running }">
    <Button type="button" static class="summary" @click="toggleGroup">
      <component :is="icon" class="tool-icon" data-icon="inline-start" />
      <span :class="{ shimmer: running, label }" :data-text="label">{{ label }}</span>

      <span
        v-if="detail"
        class="detail"
        :title="detail.kind === 'file' ? detail.path : detail.text"
      >
        <img v-if="detailIcon" class="file-icon" :src="detailIcon" alt="" />

        <span class="detail-text" :data-text="detail.kind === 'file' ? detail.name : detail.text">
          {{ detail.kind === "file" ? detail.name : detail.text }}
        </span>

        <span v-if="detail.kind === 'file' && (detail.added || detail.removed)" class="line-stats">
          <span class="added">+{{ detail.added }}</span>
          <span class="removed">-{{ detail.removed }}</span>
        </span>
      </span>

      <ChevronRight
        class="motion-turn motion-hint"
        :class="{ 'is-on': open }"
        data-icon="inline-end"
      />
    </Button>

    <div
      class="tool-calls-group"
      :class="{ 'is-open': open, instant: !open || running }"
      :inert="!open"
    >
      <div>
        <ToolStepCard
          v-if="open && thought && thought.text"
          variant="thought"
          :text="thought.text"
          :streaming="thought.streaming"
        />

        <div v-else class="calls">
          <template v-for="call in calls" :key="call.item.id">
            <div v-if="open && call.expandable" class="call">
              <ToolStepCard
                v-if="call.variant === 'command'"
                variant="command"
                :command="call.command"
                :cwd="call.cwd"
                :output-text="call.outputText"
                :output-images="call.outputImages"
                :empty-output="call.emptyOutput"
                :status="call.status"
                :status-label="call.statusLabel"
              />

              <ToolStepCard
                v-else-if="call.variant === 'read'"
                variant="read"
                :path="call.path"
                :preview="call.preview"
                :output-images="call.images"
              />

              <ToolStepCard
                v-else-if="call.variant === 'edit'"
                variant="edit"
                :edit-preview="call.editPreview"
              />

              <ToolStepCard
                v-else
                variant="tool"
                :input-full="call.inputFull"
                :output-text="call.outputText"
                :output-images="call.outputImages"
                :empty-output="call.emptyOutput"
              />
            </div>
          </template>
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
import { thoughtStepLabel } from "@features/transcript-view/lib/transcript-rows.js"
import {
  isCommandTool,
  toolCommand,
  toolInputPretty,
  toolPath,
  toolWorkingDirectory,
} from "@features/transcript-view/lib/transcript-format.js"
import { fileLanguage, readToolPreview, type ReadToolPreview } from "../lib/tool-presentation.js"
import {
  editDiffPreview,
  toolGroupKey,
  toolSummary,
  toolSummaryDetail,
  writeDiffPreview,
} from "../lib/tool-summary.js"
import type {
  EditDiffPreview,
  ToolCallView,
  ToolRowStep,
  ToolSummaryDetail,
  TranscriptImage,
} from "@features/transcript-view/type.js"

function fileDetailIcon(detail: ToolSummaryDetail | null): string {
  void languageIconsRevision.value

  if (detail?.kind !== "file") return ""
  const language = fileLanguage(detail.path)

  if (language === "text") return ""
  return `data:image/svg+xml;utf8,${encodeURIComponent(getLanguageIcon(language))}`
}

type CallBase = {
  item: ToolCallView
  expandable: boolean
}

type CallView =
  | (CallBase & {
      variant: "command"
      command: string
      cwd: string
      outputText: string
      outputImages: TranscriptImage[]
      emptyOutput: string
      status: "error" | "running" | "success"
      statusLabel: string
    })
  | (CallBase & {
      variant: "read"
      path: string
      preview?: ReadToolPreview
      images: TranscriptImage[]
    })
  | (CallBase & {
      variant: "edit"
      editPreview: EditDiffPreview
    })
  | (CallBase & {
      variant: "tool"
      inputFull: string
      outputText: string
      outputImages: TranscriptImage[]
      emptyOutput: string
    })

function output(item: ToolCallView, open: boolean) {
  return {
    outputText: open ? item.outputText : "",
    outputImages: open ? item.outputImages : [],
    emptyOutput: item.running ? "(running…)" : "(no output)",
  }
}

function callStatus(item: ToolCallView) {
  if (item.isError) return { status: "error" as const, statusLabel: "执行失败" }

  if (item.running) return { status: "running" as const, statusLabel: "正在执行" }
  return { status: "success" as const, statusLabel: "执行完成" }
}

function hasBody(item: ToolCallView): boolean {
  return (
    item.running ||
    toolInputPretty(item.input).length > 0 ||
    item.outputText.length > 0 ||
    item.outputImages.length > 0
  )
}

function presentCall(item: ToolCallView, open: boolean): CallView {
  const name = item.toolName.trim().toLowerCase()

  if (isCommandTool(name)) {
    return {
      item,
      expandable: true,
      variant: "command",
      command: toolCommand(item.input),
      cwd: toolWorkingDirectory(item.input),
      ...output(item, open),
      ...callStatus(item),
    }
  }

  const key = toolGroupKey(item.toolName)

  if (key === "read") {
    const path = toolPath(item.input)
    const out = output(item, open)

    if (open && out.outputImages.length > 0) {
      return {
        item,
        expandable: true,
        variant: "read",
        path,
        images: out.outputImages,
      }
    }

    const canPreview =
      open &&
      Boolean(path) &&
      !item.isError &&
      !item.running &&
      Boolean(out.outputText) &&
      !/^\[Line \d+ is .+ exceeds /.test(out.outputText)

    if (canPreview && path) {
      return {
        item,
        expandable: true,
        variant: "read",
        path,
        preview: readToolPreview(item.input, out.outputText),
        images: [],
      }
    }

    return {
      item,
      expandable: true,
      variant: "tool",
      inputFull: "",
      ...out,
    }
  }

  if (key === "edit" || key === "write") {
    const preview =
      open && !item.isError && !item.running
        ? key === "write"
          ? writeDiffPreview(item.input)
          : editDiffPreview(item.input)
        : null

    if (preview) {
      return { item, expandable: true, variant: "edit", editPreview: preview }
    }
  }

  return {
    item,
    expandable: hasBody(item),
    variant: "tool",
    inputFull: open ? toolInputPretty(item.input) : "",
    ...output(item, open),
  }
}

const props = defineProps<{
  step: ToolRowStep
  isExpand: Map<string, boolean>
}>()

const emit = defineEmits<{ toggle: [value: { id: string; open: boolean }] }>()

const thought = computed(() => (props.step.type === "thought" ? props.step : null))

const group = computed(() => (props.step.type === "tools" ? props.step : null))

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
  const key = group.value?.key

  if (!key) return Wrench

  switch (key) {
    case "read":
      return FileText
    case "write":
    case "edit":
      return Pencil
    case "search":
      return Search
    case "command":
      return SquareTerminal
    case "tool":
      return Wrench
    default: {
      const _exhaustive: never = key
      return _exhaustive
    }
  }
})

const calls = computed(() => {
  if (!group.value) return []
  return group.value.items.map((item) => presentCall(item, open.value))
})

function toggleGroup() {
  emit("toggle", { id: props.step.id, open: !open.value })
}
</script>

<style scoped>
.tool-summary {
  min-width: 0;
}

.tool-calls-group.is-open {
  margin-block-start: var(--spacing-xs);
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
  color: var(--ink);
}

.failed .tool-icon {
  color: var(--danger);
}

.tool-icon {
  position: relative;
  z-index: 1;
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

.line-stats {
  display: inline-flex;
  flex: none;
  gap: var(--spacing-xs);
}

.added {
  color: var(--success);
}

.removed {
  color: var(--danger);
}

.calls {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.call {
  min-width: 0;
}
</style>
