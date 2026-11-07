<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <button
        type="button"
        class="copy-button"
        :class="{ 'is-copied': status === 'copied', 'is-error': status === 'error' }"
        :aria-label="copyLabel"
        @click.stop="copy"
      >
        <CopyIcon v-show="status !== 'copied'" />
        <CheckIcon v-show="status === 'copied'" />
      </button>
    </TooltipTrigger>

    <TooltipContent>{{ copyLabel }}</TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue"
import { useTimeoutFn } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { CheckIcon, CopyIcon } from "@components/icons/index.js"

const props = defineProps<{ text: string; label?: string }>()
const { t } = useI18n()
const status = shallowRef<"idle" | "copied" | "error">("idle")
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
  top: var(--space-xxs);
  inset-inline-end: var(--space-xxs);
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
  opacity: 0.55;
  z-index: 1;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    background-color var(--duration-fast) var(--ease-out);
}

.copy-button svg {
  width: 14px;
  height: 14px;
}

.copy-button:hover,
.copy-button:focus-visible {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
  opacity: 1;
}

.copy-button.is-copied {
  color: var(--success);
  opacity: 1;
}

.copy-button.is-error {
  color: var(--danger);
  opacity: 1;
}
</style>
