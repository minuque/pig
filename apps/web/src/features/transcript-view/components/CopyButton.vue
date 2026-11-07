<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <IconButton
        type="button"
        size="s"
        variant="ghost"
        :color="status === 'error' ? 'red' : 'gray'"
        class="copy-button"
        :aria-label="copyLabel"
        @click.stop="copy"
      >
        <CheckIcon v-if="status === 'copied'" class="size-icon" />
        <CopyIcon v-else class="size-icon" />
      </IconButton>
    </TooltipTrigger>

    <TooltipContent>{{ copyLabel }}</TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue"
import { useTimeoutFn } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@components/ui/button/index.js"
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
/* 默认贴在卡片右上角；放进工具条时由父级改回静态定位 */
.copy-button {
  position: absolute;
  z-index: 1;
  top: var(--space-xxs);
  inset-inline-end: var(--space-xxs);
}
</style>
