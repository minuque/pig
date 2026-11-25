<template>
  <Tooltip>
    <TooltipTrigger>
      <template #render="{ props: part }">
        <IconButton
          v-bind="part"
          type="button"
          size="s"
          variant="ghost"
          color="neutral"
          :aria-label="t('settings.restoreDefault')"
          @click="onClick"
        >
          <RotateCcwIcon aria-hidden="true" />
        </IconButton>
      </template>
    </TooltipTrigger>

    <TooltipContent>{{ t("settings.restoreDefault") }}</TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@pig/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import { RotateCcwIcon } from "@components/icons/index.js"

const emit = defineEmits<{ reset: [] }>()
const { t } = useI18n()

function onClick(event: MouseEvent) {
  const button = event.currentTarget as HTMLElement
  const row = button.closest<HTMLElement>("[data-slot='card-row']")
  const control = [
    ...(row?.querySelectorAll<HTMLElement>("button, input, [role='slider']") ?? []),
  ].find((element) => element !== button)

  control?.focus({ preventScroll: true })
  emit("reset")
}
</script>
