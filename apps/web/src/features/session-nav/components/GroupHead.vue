<template>
  <div class="group-head">
    <button class="group-toggle" type="button" @click="emit('toggle')">
      <span class="mark">
        <ChevronRight
          class="group-chevron motion-turn"
          :class="{ 'is-on': !collapsed }"
          :size="16"
        />
      </span>
      <span class="group-name">{{ name }}</span>
    </button>
    <button
      class="group-new motion-hint"
      type="button"
      :disabled="creating"
      title="新会话"
      @click.stop="emit('create')"
    >
      <Plus :size="16" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight, Plus } from "lucide-vue-next"

defineProps<{
  name: string
  collapsed?: boolean
  creating?: boolean
}>()

const emit = defineEmits<{
  toggle: []
  create: []
}>()
</script>

<style scoped>
.group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding-inline: 8px;
  border-radius: var(--radius-md);
}
.group-head:hover {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
}
.group-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex: 1;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
}
.mark {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}
.group-chevron {
  color: var(--ink-faint);
}
.group-head:hover .group-chevron {
  color: var(--ink-muted);
}
.group-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--ink);
  font-size: var(--text-body-md);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body-md--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group-new {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  line-height: 0;
}
.group-new:hover:not(:disabled),
.group-new:focus-visible:not(:disabled) {
  color: var(--ink);
}
.group-new:disabled {
  opacity: 0.45;
}
</style>
