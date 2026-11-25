<template>
  <Tooltip>
    <TooltipTrigger>
      <template #render="{ props: part }">
        <button
          v-bind="part"
          type="button"
          class="pin-toggle"
          :aria-label="t('session.unpin')"
          :disabled="disabled"
          @click.prevent.stop="emit('toggle')"
          @pointerdown.stop
        >
          <PinIcon class="pin-on" />
          <PinOffIcon class="pin-off" />
        </button>
      </template>
    </TooltipTrigger>

    <TooltipContent>{{ t("session.unpin") }}</TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import { PinIcon, PinOffIcon } from "@components/icons/index.js"

defineProps<{ disabled: boolean }>()

const emit = defineEmits<{ toggle: [] }>()
const { t } = useI18n()
</script>

<style scoped>
.pin-toggle {
  display: inline-flex;
  flex: none;
  align-items: center;
  padding: 0;
  border: 0;
  border-radius: var(--radius-min);
  background: transparent;
  color: var(--fg-secondary);
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-out);
}

.pin-toggle :deep(svg) {
  inline-size: var(--icon-sm);
  block-size: var(--icon-sm);
}

.pin-toggle .pin-off,
.pin-toggle:is(:hover, :focus-visible):not(:disabled) .pin-on {
  display: none;
}

.pin-toggle:is(:hover, :focus-visible):not(:disabled) .pin-off {
  display: block;
}

.pin-toggle:is(:hover, :focus-visible):not(:disabled) {
  color: var(--fg);
}

.pin-toggle:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.pin-toggle:disabled {
  cursor: default;
}
</style>
