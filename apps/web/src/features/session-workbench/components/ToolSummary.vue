<template>
  <div class="tool">
    <p v-if="!expandable" class="tool-summary">
      <component :is="toolIcon" class="tool-icon" :size="14" aria-hidden="true" />
      <span class="tool-name">{{ part.name }}</span>
      <span v-if="statusLabel" class="tool-meta">{{ statusLabel }}</span>
      <span v-else-if="excerpt" class="tool-excerpt">{{ excerpt }}</span>
    </p>
    <FoldReveal v-else toggle-class="tool-summary">
      <template #summary>
        <component :is="toolIcon" class="tool-icon" :size="14" aria-hidden="true" />
        <span class="tool-name">{{ part.name }}</span>
        <span v-if="statusLabel" class="tool-meta">{{ statusLabel }}</span>
        <span v-else-if="excerpt" class="tool-excerpt">{{ excerpt }}</span>
      </template>
      <ExpandableText :text="part.text" />
    </FoldReveal>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { FileText, Pencil, Search, Terminal, Wrench } from "lucide-vue-next";
import ExpandableText from "@features/session-workbench/components/ExpandableText.vue";
import FoldReveal from "@features/session-workbench/components/FoldReveal.vue";
import {
  toolStatusLabel,
  type TranscriptPart,
} from "@features/session-workbench/transcript-format.js";

const props = defineProps<{
  part: Extract<TranscriptPart, { kind: "tool" }>;
}>();

// 仅非空工具输出才提供展开；无文本保持静态一行。
const expandable = computed(() => props.part.text.trim().length > 0);
const statusLabel = computed(() => {
  const label = toolStatusLabel(props.part.status, props.part.isError);
  return label === "完成" ? "" : label;
});
const excerpt = computed(() => {
  const line = props.part.text.trim().split(/\r?\n/, 1)[0] ?? "";
  return line.length > 88 ? `${line.slice(0, 88)}…` : line;
});
const toolIcon = computed(() => {
  const name = props.part.name.toLowerCase();
  if (/(read|cat|open)/.test(name)) return FileText;
  if (/(write|edit|apply)/.test(name)) return Pencil;
  if (/(bash|shell|exec|cmd)/.test(name)) return Terminal;
  if (/(grep|search|find)/.test(name)) return Search;
  return Wrench;
});
</script>

<style scoped>
.tool {
  margin: 0 0 10px;
}
.tool-summary,
.tool :deep(.tool-summary) {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  width: 100%;
  padding: 2px 0;
  border: 0;
  border-radius: 0;
  color: var(--ink-muted);
  font-size: var(--text-caption);
  font-weight: inherit;
}
.tool-icon {
  flex: none;
  opacity: 0.8;
}
.tool-name {
  flex: none;
  color: var(--ink-secondary);
  font-weight: var(--font-weight-medium);
}
.tool-meta,
.tool-excerpt {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
