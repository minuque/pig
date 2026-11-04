<template>
  <Story title="Switch">
    <Variant title="Sizes">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px">
        <Switch v-model="on" size="s" aria-label="Small switch" />
        <Switch v-model="on" size="m" aria-label="Medium switch" />
        <Switch v-model="on" size="l" aria-label="Large switch" />
      </div>
    </Variant>

    <Variant title="Variants">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px">
        <Switch v-model="on" variant="classic" aria-label="Classic switch" />
        <Switch v-model="on" variant="surface" aria-label="Surface switch" />
        <Switch v-model="on" variant="soft" aria-label="Soft switch" />
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

    <Variant title="High contrast">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px">
        <Switch v-model="on" high-contrast aria-label="High contrast switch" />
        <Switch v-model="off" high-contrast aria-label="High contrast off switch" />
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { Switch } from "./index.js"

const on = ref(true)
const off = ref(false)
</script>
