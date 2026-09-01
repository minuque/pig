<template>
  <div class="thought">
    <Button
      type="button"
      static
      class="toggle"
      :aria-expanded="open || previewing"
      :aria-controls="bodyId"
      @click="open = !open"
    >
      <Lightbulb :stroke-width="1.5" data-icon="inline-start" aria-hidden="true" />
      <span>{{ streaming ? "思考中" : "思考" }}</span>
      <span v-if="previewing" class="hint">展开全文</span>
      <ChevronRight
        class="caret"
        :class="{ open }"
        :stroke-width="1.5"
        data-icon="inline-end"
        aria-hidden="true"
      />
    </Button>
    <div
      :id="bodyId"
      class="body"
      :class="{ open: open || previewing }"
      :inert="!open && !previewing"
      :aria-hidden="!open && !previewing"
    >
      <div class="body-inner">
        <ToolStepCard v-if="text">
          <div
            v-if="!open"
            ref="preview"
            class="thought-content preview"
            role="region"
            aria-label="实时思考预览"
            tabindex="0"
            @wheel.stop
            @scroll.stop
          >
            {{ text }}
          </div>
          <div v-else class="thought-content">
            <ThinkingBlocks :blocks="[text]" />
          </div>
        </ToolStepCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useId, useTemplateRef, watch } from "vue"
import { ChevronRight, Lightbulb } from "lucide-vue-next"
import { Button } from "@components/ui/button/index.js"
import ThinkingBlocks from "./ThinkingBlocks.vue"
import ToolStepCard from "./ToolStepCard.vue"

const props = defineProps<{ text: string; streaming: boolean }>()
const open = defineModel<boolean>("open", { required: true })
const bodyId = useId()
const preview = useTemplateRef<HTMLElement>("preview")
const previewing = computed(() => props.streaming && !open.value)
watch(
  [() => props.text, preview],
  () => {
    const element = preview.value
    if (element) element.scrollTop = element.scrollHeight
  },
  { flush: "post" },
)
</script>

<style scoped>
.thought {
  min-width: 0;
}
.toggle {
  height: auto;
  min-height: 28px;
  padding: 2px 0;
  gap: var(--spacing-xs);
  background: transparent;
  color: var(--ink-muted);
  border-radius: 0;
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-regular);
}
.toggle:hover {
  background: transparent;
  color: var(--ink-secondary);
}
.hint {
  font-size: var(--text-caption);
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
.thought-content {
  padding: var(--spacing-sm);
}
.preview {
  max-height: 5lh;
  overflow-y: auto;
  overscroll-behavior: contain;
  overflow-anchor: none;
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  scrollbar-width: thin;
}
@media (prefers-reduced-motion: reduce) {
  .body,
  .caret {
    transition: none;
  }
}
</style>
