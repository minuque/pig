<template>
  <div class="call">
    <button
      type="button"
      class="toggle"
      :aria-expanded="open"
      :aria-label="toggleLabel"
      @click="onToggle"
    >
      <Asterisk class="icon" :size="16" aria-hidden="true" />
      <span class="kind">Think</span>
      <span class="detail">{{ detail }}</span>
      <ChevronRight class="caret" :size="14" aria-hidden="true" />
    </button>
    <div v-if="open && text" class="body">
      <ThinkingBlocks :blocks="[text]" :streaming="streaming" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Asterisk, ChevronRight } from "lucide-vue-next"
import ThinkingBlocks from "@features/transcript-view/components/ThinkingBlocks.vue"

const props = defineProps<{
  text: string
  streaming: boolean
}>()

const open = defineModel<boolean>("open", { required: true })
const detail = computed(() => (props.streaming ? "Thinking…" : "Thought"))
const toggleLabel = computed(() => `Think ${detail.value}`)

function onToggle() {
  if (props.streaming) return
  open.value = !open.value
}
</script>

<style scoped>
.call {
  contain: layout style;
  overflow: hidden;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-xl);
  background: var(--canvas-soft);
}
.toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
  min-width: 0;
  min-height: 40px;
  padding: 8px 12px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-caption);
  font-weight: inherit;
  text-align: left;
}
.toggle:hover {
  color: var(--ink);
}
.toggle:not(:disabled):active {
  transform: none;
}
.icon {
  flex: none;
  color: var(--ink-faint);
}
.kind {
  flex: none;
  color: var(--ink-secondary);
  font-weight: var(--font-weight-medium);
}
.detail {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--ink-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.caret {
  flex: none;
  color: var(--ink-faint);
  transition: transform var(--duration-fast) var(--ease-smooth);
}
.toggle[aria-expanded="true"] .caret {
  transform: rotate(90deg);
}
.body {
  padding: 0 12px 10px;
}
@media (prefers-reduced-motion: reduce) {
  .caret {
    transition: none;
  }
}
</style>
