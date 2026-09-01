<template>
  <ToolCall v-if="directCommand" :item="directCommand" :open="true" direct />
  <div v-else class="tool-summary" :class="{ failed }">
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
      <div class="body-inner">
        <ToolCall
          v-for="item in group.items"
          :key="item.id"
          :item="item"
          :open="open && expanded.get(item.id) === true"
          @update:open="emit('toggle', { id: item.id, open: $event })"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from "vue"
import { ChevronRight, FileText, Pencil, Search, SquareTerminal, Wrench } from "lucide-vue-next"
import { Button } from "@components/ui/button/index.js"
import ToolCall from "./ToolCall.vue"
import type { ToolGroup } from "../lib/transcript-rows.js"
import { directCommandItem, toolSummary, toolSummaryDetail } from "../lib/tool-summary.js"

const props = defineProps<{ group: ToolGroup; expanded: Map<string, boolean> }>()
const emit = defineEmits<{ toggle: [value: { id: string; open: boolean }] }>()
const bodyId = useId()
const directCommand = computed(() => directCommandItem(props.group))
const open = computed(() => props.expanded.get(props.group.id) === true)
const failed = computed(() => props.group.items.some((item) => item.isError))
const label = computed(() => toolSummary(props.group.items))
const detail = computed(() => toolSummaryDetail(props.group.items))
function toggleGroup() {
  const first = props.group.items[0]
  if (!open.value && props.group.items.length === 1 && first && !props.expanded.has(first.id)) {
    emit("toggle", { id: first.id, open: true })
  }
  emit("toggle", { id: props.group.id, open: !open.value })
}
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
@media (prefers-reduced-motion: reduce) {
  .body,
  .caret {
    transition: none;
  }
}
</style>
