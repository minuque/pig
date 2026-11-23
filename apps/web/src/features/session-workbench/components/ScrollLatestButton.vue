<template>
  <div class="session-floating-controls" :class="{ shown }">
    <span class="scroll-latest">
      <Button
        class="scroll-latest-button"
        type="button"
        variant="solid"
        color="neutral"
        size="s"
        radius="full"
        @click="emit('click')"
      >
        <LoaderIcon v-if="pending" class="size-icon is-spinning" />
        <ArrowDownIcon v-else class="size-icon" />
        {{ t("transcript.scrollToBottom") }}
      </Button>
    </span>
  </div>
</template>

<script setup lang="ts">
import { ArrowDownIcon, LoaderIcon } from "@components/icons/index.js"
import { Button } from "@components/ui/button/index.js"
import { useI18n } from "@i18n/index.js"

defineProps<{
  shown: boolean
  pending: boolean
}>()

const emit = defineEmits<{
  click: []
}>()
const { t } = useI18n()
</script>

<style scoped>
.session-floating-controls {
  position: absolute;
  inset-block-start: 0;
  inset-inline: 0;
  z-index: var(--z-raise);
  display: flex;
  justify-content: center;
  height: 0;
  overflow: visible;
  pointer-events: none;
  opacity: 0;
  translate: 0 var(--space-2xs);
  transition:
    opacity var(--duration-fast) var(--ease-out),
    translate var(--duration-normal) var(--ease-spring);
}

.session-floating-controls.shown {
  opacity: 1;
  translate: 0 0;
}

.session-floating-controls.shown .scroll-latest {
  pointer-events: auto;
}

.scroll-latest {
  display: flex;
  align-self: flex-start;
  translate: 0 calc(-100% - var(--space-sm));
}

.scroll-latest-button {
  background-color: var(--bg-inverse);
  color: var(--fg-inverse);
}

.scroll-latest-button:hover {
  background-color: var(--bg-inverse-hover);
  background-image: none;
}

@media (prefers-reduced-motion: reduce) {
  .session-floating-controls {
    transition: none;
  }
}
</style>
