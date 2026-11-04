<template>
  <Story title="Slider">
    <Variant title="Sizes">
      <div style="display: flex; flex-direction: column; gap: 24px; max-width: 320px">
        <Slider v-model="value" size="s" aria-label="Small slider" />
        <Slider v-model="value" size="m" aria-label="Medium slider" />
        <Slider v-model="value" size="l" aria-label="Large slider" />
      </div>
    </Variant>

    <Variant title="Variants">
      <div style="display: flex; flex-direction: column; gap: 24px; max-width: 320px">
        <Slider v-model="value" variant="classic" aria-label="Classic slider" />
        <Slider v-model="value" variant="surface" aria-label="Surface slider" />
        <Slider v-model="value" variant="soft" aria-label="Soft slider" />
      </div>
    </Variant>

    <Variant title="Range">
      <div style="max-width: 320px">
        <Slider v-model="range" aria-label="Price range" />
      </div>
    </Variant>

    <Variant title="States">
      <div style="display: flex; flex-direction: column; gap: 24px; max-width: 320px">
        <Slider v-model="value" aria-label="Default slider" />
        <Slider v-model="value" disabled aria-label="Disabled slider" />
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { Slider } from "./index.js"

const value = ref([40])
const range = ref([20, 70])
</script>
