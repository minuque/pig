<template>
  <Slider
    v-if="steps > 0"
    class="effort-slider"
    size="s"
    :model-value="[activeIndex]"
    :min="0"
    :max="steps"
    :step="1"
    :aria-label="t('composer.thinkingEffort')"
    :format-value="labelAt"
    :get-aria-value-text="labelAt"
    :disabled="disabled"
    @update:model-value="onUpdate"
  />
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { Slider } from "@components/ui/slider/index.js"
import { displayThinkingLevel, formatThinkingLevel } from "@features/composer/lib/thinking-level.js"

const props = defineProps<{
  levels: readonly string[]
  level: string
  disabled?: boolean
}>()
const emit = defineEmits<{
  "update:level": [value: string]
}>()
const { t } = useI18n()
const steps = computed(() => Math.max(props.levels.length - 1, 0))
const activeIndex = computed(() =>
  Math.max(0, props.levels.indexOf(displayThinkingLevel(props.level, props.levels))),
)

function labelAt(index: number) {
  return formatThinkingLevel(props.levels[Math.round(index)] ?? "")
}

function onUpdate(values: number[] | undefined) {
  const next = props.levels[Math.round(values?.[0] ?? 0)]

  if (next !== undefined) emit("update:level", next)
}
</script>

<style scoped>
.effort-slider {
  padding: var(--space-xs) 10px var(--space-sm);
}
</style>
