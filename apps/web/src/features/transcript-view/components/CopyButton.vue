<template>
  <Tooltip>
    <TooltipTrigger>
      <template #render="{ props: part }">
        <IconButton
          v-bind="part"
          type="button"
          size="s"
          variant="ghost"
          :color="tone"
          class="copy-button"
          :aria-label="copyLabel"
          @click.stop="copy"
        >
          <CheckIcon v-if="status === 'copied'" class="size-icon motion-blur-in" />
          <CopyIcon v-else :class="['size-icon', { 'motion-blur-in': swapped }]" />
        </IconButton>
      </template>
    </TooltipTrigger>

    <TooltipContent>{{ copyLabel }}</TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue"
import { useTimeoutFn } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@pig/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import { CheckIcon, CopyIcon } from "@components/icons/index.js"

const props = defineProps<{ text: string; label?: string }>()
const { t } = useI18n()
const status = shallowRef<"idle" | "copied" | "error">("idle")
const swapped = shallowRef(false)
const tone = computed(() =>
  status.value === "copied" ? "success" : status.value === "error" ? "danger" : "neutral",
)
const copyLabel = computed(() =>
  status.value === "copied"
    ? t("common.copied")
    : status.value === "error"
      ? t("common.copyFailed")
      : (props.label ?? t("common.copyMessage")),
)
const { start, stop } = useTimeoutFn(() => (status.value = "idle"), 1500, { immediate: false })

async function copy() {
  if (!props.text) return
  stop()
  swapped.value = true

  try {
    await navigator.clipboard.writeText(props.text)
    status.value = "copied"
    start()
  } catch {
    status.value = "error"
    start()
  }
}
</script>

<style scoped>
.copy-button {
  position: absolute;
  z-index: var(--z-raise);
  top: var(--space-2xs);
  inset-inline-end: var(--space-2xs);
  color: var(--fg-secondary);
}

.copy-button:hover {
  color: var(--fg);
}

.copy-button:not([data-tone="neutral"]) svg {
  color: var(--tone-text);
}
</style>
