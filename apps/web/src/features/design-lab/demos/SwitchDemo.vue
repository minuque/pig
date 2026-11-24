<template>
  <Story title="Switch">
    <Variant title="Sizes">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px">
        <Switch v-model="on" size="s" aria-label="Small switch" />
        <Switch v-model="on" size="m" aria-label="Medium switch" />
        <Switch v-model="on" size="l" aria-label="Large switch" />
      </div>
    </Variant>

    <Variant title="States">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px">
        <Switch v-model="on" aria-label="On switch" />
        <Switch v-model="off" aria-label="Off switch" />
        <Switch v-model="on" disabled aria-label="Disabled on switch" />
        <Switch v-model="off" disabled aria-label="Disabled off switch" />
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { ref } from "vue"
import { Switch } from "@pig/ui/switch"

const on = ref(true)
const off = ref(false)
</script>
