<template>
  <div class="call">
    <button type="button" class="toggle" :class="{ open }" :disabled="streaming" @click="onToggle">
      <Brain class="icon" :size="16" />
      <span class="kind">Think</span>
      <span v-if="detail" class="detail">{{ detail }}</span>
      <ChevronRight class="caret caret-hint" :size="14" />
    </button>
    <Transition name="fold-reveal">
      <div v-if="open && text" class="body">
        <ThinkingBlocks :blocks="[text]" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Brain, ChevronRight } from "lucide-vue-next"
import ThinkingBlocks from "@features/transcript-view/components/ThinkingBlocks.vue"

const props = defineProps<{
  text: string
  streaming: boolean
}>()

const open = defineModel<boolean>("open", { required: true })
const detail = computed(() => (props.streaming ? "Thinking…" : ""))

function onToggle() {
  if (props.streaming) return
  open.value = !open.value
}
</script>

<style scoped>
.call {
  contain: layout style;
  min-width: 0;
}
.toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: fit-content;
  max-width: 100%;
  min-width: 0;
  min-height: 22px;
  padding: 2px 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  font-weight: inherit;
  text-align: left;
}
.toggle:hover {
  color: var(--ink);
}
.toggle:disabled {
  cursor: default;
  opacity: 1;
}
.toggle:not(:disabled):active {
  transform: none;
}
.toggle:focus {
  outline: none;
}
.toggle:focus-visible {
  outline: var(--focus-ring-width) solid var(--primary);
  outline-offset: var(--focus-ring-width);
}
.icon {
  flex: none;
  color: var(--ink-faint);
}
.kind {
  flex: none;
  color: var(--ink-muted);
  font-weight: var(--font-weight-regular);
}
.toggle:hover .kind,
.toggle.open .kind {
  color: var(--ink-secondary);
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
}
.body {
  min-width: 0;
  margin-top: 2px;
  margin-inline-start: 24px;
}
</style>
