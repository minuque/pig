<template>
  <CodeBlockNode v-bind="attrs" :node="highlightNode">
    <template v-if="fence.isFileReference" #header-left>
      <span class="fence-file" :title="fence.filePath ?? undefined">
        <span class="fence-name">{{ fence.fileName }}</span>
        <span v-if="fence.directory" class="fence-dir">{{ fence.directory }}</span>
        <span v-if="fence.lineRange" class="fence-lines">{{ fence.lineRange }}</span>
      </span>
    </template>
  </CodeBlockNode>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue"
import { CodeBlockNode, type CodeBlockNodeProps } from "markstream-vue"
import { fenceHighlightNode, parseCodeFenceInfo } from "@features/transcript-view/lib/code-fence.js"

defineOptions({ inheritAttrs: false })

const props = defineProps<{ node: CodeBlockNodeProps["node"] }>()
const attrs = useAttrs()
const fence = computed(() => parseCodeFenceInfo(props.node.language))
const highlightNode = computed(() => fenceHighlightNode(props.node, fence.value))
</script>

<style scoped>
.fence-file {
  display: inline-flex;
  align-items: baseline;
  min-width: 0;
  gap: 0.4em;
  font-family: var(--font-mono);
  font-size: var(--text-caption-mono);
  line-height: 1.4;
}

.fence-name {
  flex: none;
  color: var(--ink);
  font-weight: var(--font-weight-medium);
}

.fence-dir,
.fence-lines {
  color: var(--ink-muted);
}

.fence-dir {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fence-lines {
  flex: none;
  font-variant-numeric: tabular-nums;
}
</style>
