<template>
  <Story title="Checkbox">
    <Variant title="Sizes">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px">
        <Checkbox v-model="checked" size="s" aria-label="Small checkbox" />
        <Checkbox v-model="checked" size="m" aria-label="Medium checkbox" />
      </div>
    </Variant>

    <Variant title="Variants">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px">
        <Checkbox v-model="checked" variant="surface" aria-label="Surface checkbox" />
        <Checkbox v-model="checked" variant="soft" aria-label="Soft checkbox" />
      </div>
    </Variant>

    <Variant title="States">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px">
        <Checkbox v-model="checked" aria-label="Checked" />
        <Checkbox v-model="unchecked" aria-label="Unchecked" />
        <Checkbox v-model="mixed" aria-label="Indeterminate" />
        <Checkbox v-model="checked" disabled aria-label="Disabled checked" />
        <Checkbox v-model="unchecked" disabled aria-label="Disabled unchecked" />
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { ref } from "vue"
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Checkbox } from "@pig/ui/checkbox"

const checked = ref<boolean | "indeterminate">(true)
const unchecked = ref<boolean | "indeterminate">(false)
const mixed = ref<boolean | "indeterminate">("indeterminate")
</script>
