<template>
  <div class="diagram-card">
    <div class="diagram-header">
      <Tooltip v-if="svg">
        <TooltipTrigger as-child>
          <button
            type="button"
            class="mode-toggle"
            :aria-label="modeLabel"
            @click.stop="showSource = !showSource"
          >
            <CodeSquareIcon v-if="!showSource" class="size-icon" />
            <ChartSquareIcon v-else class="size-icon" />
          </button>
        </TooltipTrigger>

        <TooltipContent>{{ modeLabel }}</TooltipContent>
      </Tooltip>

      <CopyButton :text="source" :label="t('transcript.copyCode')" />
    </div>

    <!-- eslint-disable-next-line vue/no-v-html -- pele 由源码生成的 SVG -->
    <div v-if="svg && !showSource" class="diagram-preview mermaid-diagram" v-html="svg" />
    <div v-else class="diagram-source">{{ source }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { ChartSquareIcon, CodeSquareIcon } from "@components/icons/index.js"
import CopyButton from "@features/transcript-view/components/CopyButton.vue"
import { renderMermaid } from "@features/transcript-view/lib/mermaid-runtime.js"

const props = defineProps<{ source: string }>()
const { t } = useI18n()
const svg = shallowRef("")
const showSource = ref(false)
const modeLabel = computed(() =>
  showSource.value ? t("transcript.diagramShow") : t("transcript.diagramSource"),
)

// 渲染失败保留上一次成功的图；从没成功过就显示源码。
watch(
  () => props.source,
  async (source, _, onCleanup) => {
    let active = true
    onCleanup(() => (active = false))

    try {
      const next = await renderMermaid(source)

      if (active) svg.value = next
    } catch {
      /* 保持现状 */
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.diagram-card {
  min-width: 0;
  overflow: hidden;
  border: var(--border-width) solid var(--border-soft);
  border-radius: var(--radius-code);
  background: var(--code-background);
  color: var(--code-foreground);
}

.diagram-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: calc(22px + var(--space-xxs) * 2);
  padding: var(--space-xxs) var(--space-sm);
  padding-inline-end: calc(22px + var(--space-xxs) * 2);
}

.mode-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--contrast-foreground-faint);
  cursor: pointer;
}

.mode-toggle:hover {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.diagram-preview {
  display: flex;
  justify-content: center;
  padding: 0 var(--space-sm) var(--space-sm);
  overflow-x: auto;
}

.diagram-preview :deep(svg) {
  max-width: 100%;
  height: auto;
}

.diagram-source {
  padding: 0 var(--space-sm) var(--space-sm);
  font-family: var(--font-mono);
  font-size: var(--text-code);
  line-height: var(--text-code-line);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
