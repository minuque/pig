<template>
  <RadioCards
    class="preset-swatches"
    :model-value="presetId"
    size="s"
    columns="repeat(auto-fit, minmax(96px, 1fr))"
    gap="xs"
    :aria-label="t('settings.themePreset')"
    @update:model-value="(value) => setPreset(value as ThemePresetId)"
  >
    <RadioCardsItem
      v-for="option in options"
      :key="option.id"
      :value="option.id"
      class="preset-chip"
    >
      <span class="preset-dot" :style="{ background: swatchGradient(option) }" aria-hidden="true" />
      <span class="preset-label">{{ option.label }}</span>
    </RadioCardsItem>
  </RadioCards>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { ThemePreset, ThemePresetId } from "@/types/theme-type.js"
import { useI18n } from "@i18n/index.js"
import { useColorScheme } from "@features/theme/index.js"
import { RadioCards, RadioCardsItem } from "@components/ui/radio-cards/index.js"

const LABEL_KEYS: Record<ThemePresetId, string> = {
  linear: "settings.presetLinear",
  paper: "settings.presetPaper",
  ocean: "settings.presetOcean",
  grove: "settings.presetGrove",
  iris: "settings.presetIris",
}
const { t } = useI18n()
const { isDark, presetId, presets, setPreset } = useColorScheme()
const options = computed(() =>
  presets.map((preset) => ({
    ...preset,
    label: t(LABEL_KEYS[preset.id]),
  })),
)

function swatchGradient(preset: ThemePreset): string {
  const seed = isDark.value ? preset.dark : preset.light
  return `linear-gradient(135deg, ${seed.canvas} 48%, ${seed.accent} 48%)`
}
</script>

<style scoped>
.preset-swatches :deep(.preset-chip) {
  min-inline-size: 0;
  min-block-size: var(--control-md);
  padding-block: 0;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-meta--line-height);
}

.preset-swatches :deep(.preset-chip[data-state="checked"]) {
  color: var(--fg);
}

.preset-dot {
  flex: none;
  inline-size: var(--icon-md);
  block-size: var(--icon-md);
  border-radius: var(--radius-pill);
  box-shadow: inset 0 0 0 var(--border-width) var(--border-strong);
}

.preset-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
