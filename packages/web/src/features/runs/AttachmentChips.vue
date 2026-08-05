<template>
  <div v-if="attachments.length" class="chips">
    <span
      v-for="att in attachments"
      :key="att.id"
      class="chip"
      :data-exit="exiting.includes(att.id) || undefined"
    >
      <span class="chip-icon">
        <ImageIcon v-if="att.kind === 'image'" :size="13" />
        <Paperclip v-else :size="13" />
      </span>
      <span class="chip-name">{{ att.name }}</span>
      <button
        type="button"
        class="chip-remove"
        :aria-label="'Remove ' + att.name"
        @click="emit('remove', att.id)"
      >
        <X :size="11" />
      </button>
    </span>
  </div>
</template>

<script setup lang="ts">
import { Image as ImageIcon, Paperclip, X } from "lucide-vue-next";
import type { Attachment } from "../../components/composer/use-attachments.js";

const props = defineProps<{
  attachments: Attachment[];
  /** 正在播放移除动画、待清除的附件 id */
  exiting: number[];
}>();

const emit = defineEmits<{
  remove: [id: number];
}>();
</script>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: -6px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  padding: 3px 4px 3px 5px;
  border-radius: 999px;
  background: var(--surface);
  border: 0.5px solid var(--hairline);
  color: var(--ink);
  font-size: 11px;
  line-height: 14px;
  animation: pi-chip-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.chip[data-exit] {
  animation: pi-pill-out 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
  pointer-events: none;
}
.chip-icon {
  display: inline-flex;
  flex: none;
  color: var(--ink-faint);
}
.chip-name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: -2px;
  width: 15px;
  height: 15px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--ink-faint);
  cursor: pointer;
  transition:
    background 150ms cubic-bezier(0.22, 1, 0.36, 1),
    color 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
.chip-remove:hover {
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  color: var(--ink);
}
@keyframes pi-chip-in {
  from {
    opacity: 0;
    transform: translateY(4px);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}
@keyframes pi-pill-out {
  from {
    opacity: 1;
    transform: scale(1);
    filter: blur(0);
  }
  to {
    opacity: 0;
    transform: scale(0.96);
    filter: blur(2px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .chip-remove {
    transition: none;
  }
  .chip,
  .chip[data-exit] {
    animation: none;
  }
}
</style>
