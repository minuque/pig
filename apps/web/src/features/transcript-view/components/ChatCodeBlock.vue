<template>
  <div ref="host" class="chat-code">
    <CodeBlockNode v-bind="attrs" :show-line-numbers="showLineNumbers" :node="highlightNode">
      <template v-if="fence.isFileReference" #header-left>
        <span class="fence-file" :title="fence.filePath ?? undefined">
          <span class="fence-name">{{ fence.fileName }}</span>
          <span v-if="fence.directory" class="fence-dir">{{ fence.directory }}</span>
          <span v-if="fence.lineRange" class="fence-lines">{{ fence.lineRange }}</span>
        </span>
      </template>
    </CodeBlockNode>

    <Teleport v-if="actionsHost" :to="actionsHost">
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            type="button"
            class="line-toggle"
            :aria-label="showLineNumbers ? '隐藏行号' : '显示行号'"
            :aria-pressed="showLineNumbers"
            @click.stop="showLineNumbers = !showLineNumbers"
          >
            <ListOrdered class="size-3.5" />
          </button>
        </TooltipTrigger>

        <TooltipContent>{{ showLineNumbers ? "隐藏行号" : "显示行号" }}</TooltipContent>
      </Tooltip>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, useAttrs, useTemplateRef } from "vue"
import { useMutationObserver } from "@vueuse/core"
import { ListOrdered } from "@lucide/vue"
import { CodeBlockNode, type CodeBlockNodeProps } from "markstream-vue"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { fenceHighlightNode, parseCodeFenceInfo } from "@features/transcript-view/lib/code-fence.js"

defineOptions({ inheritAttrs: false })

const props = defineProps<{ node: CodeBlockNodeProps["node"] }>()
const attrs = useAttrs()
const fence = computed(() => parseCodeFenceInfo(props.node.language))
const highlightNode = computed(() => fenceHighlightNode(props.node, fence.value))
const showLineNumbers = ref(false)
const host = useTemplateRef<HTMLElement>("host")
const actionsHost = shallowRef<Element | null>(null)

function bindActions() {
  const btn = host.value?.querySelector(".code-block-header .code-action-btn")
  const next = btn?.parentElement ?? null

  if (next !== actionsHost.value) actionsHost.value = next
}

onMounted(bindActions)

useMutationObserver(host, bindActions, { childList: true, subtree: true })
</script>

<style scoped>
.chat-code {
  min-width: 0;
}

.line-toggle {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: var(--ms-action-btn-padding);
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--code-action-fg);
  cursor: pointer;
  line-height: 1;
}

.line-toggle:hover,
.line-toggle[aria-pressed="true"] {
  background: var(--code-action-hover-bg);
  color: var(--code-action-hover-fg);
}

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
