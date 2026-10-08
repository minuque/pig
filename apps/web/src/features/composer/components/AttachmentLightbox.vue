<template>
  <Teleport to="body">
    <div
      class="lightbox"
      role="dialog"
      aria-modal="true"
      :aria-label="t('common.preview', { name })"
      @click.self="emit('close')"
    >
      <img class="lightbox-img" :src="url" :alt="name" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useEventListener } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"

const { t } = useI18n()

defineProps<{
  url: string
  name: string
}>()

const emit = defineEmits<{
  close: []
}>()

useEventListener(window, "keydown", (e: KeyboardEvent) => {
  if (e.key === "Escape") emit("close")
})
</script>

<style scoped>
.lightbox {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: grid;
  place-items: center;
  padding: var(--spacing-xl);
  background: var(--scrim);
  cursor: zoom-out;
}

.lightbox-img {
  max-width: 100%;
  max-height: 100%;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-modal);
}
</style>
