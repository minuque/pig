<template>
  <Story title="Slider">
    <Variant title="Sizes">
      <div style="display: flex; flex-direction: column; gap: 32px; max-width: 320px">
        <Slider v-model="value" size="s" aria-label="Small slider" />
        <Slider v-model="value" size="m" aria-label="Medium slider" />
        <Slider v-model="value" size="l" aria-label="Large slider" />
      </div>
    </Variant>

    <Variant title="Steps & Format">
      <div style="display: flex; flex-direction: column; gap: 32px; max-width: 320px">
        <Slider
          v-model="effort"
          :min="0"
          :max="LEVELS.length - 1"
          :step="1"
          label="Thinking effort"
          :format-value="levelAt"
          :get-aria-value-text="levelAt"
        />
      </div>
    </Variant>

    <Variant title="Range">
      <div style="display: flex; flex-direction: column; gap: 32px; max-width: 320px">
        <Slider v-model="range" label="Price" :format-value="priceAt" />
      </div>
    </Variant>

    <Variant title="Disabled">
      <div style="display: flex; flex-direction: column; gap: 32px; max-width: 320px">
        <Slider v-model="value" label="Volume" disabled />
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { ref } from "vue"
import { Slider } from "@pig/ui/slider"
import { formatThinkingLevel } from "@features/composer/lib/thinking-level.js"

const LEVELS = ["off", "low", "medium", "high", "max"]
const value = ref([40])
const range = ref([20, 70])
const effort = ref([2])

function levelAt(index: number) {
  return formatThinkingLevel(LEVELS[Math.round(index)] ?? "")
}

function priceAt(value: number) {
  return `$${value}`
}
</script>
