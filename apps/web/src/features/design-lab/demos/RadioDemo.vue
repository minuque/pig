<template>
  <Story title="Radio">
    <Variant title="Sizes">
      <div style="display: flex; flex-direction: column; gap: 12px">
        <label style="display: flex; align-items: center; gap: 8px">
          <Radio value="s" size="s" :checked="true" />
          Small
        </label>

        <label style="display: flex; align-items: center; gap: 8px">
          <Radio value="m" size="m" :checked="true" />
          Medium
        </label>

        <label style="display: flex; align-items: center; gap: 8px">
          <Radio value="l" size="l" :checked="true" />
          Large
        </label>
      </div>
    </Variant>

    <Variant title="Variants">
      <div style="display: flex; flex-direction: column; gap: 12px">
        <label style="display: flex; align-items: center; gap: 8px">
          <Radio value="classic" variant="classic" :checked="true" />
          Classic
        </label>

        <label style="display: flex; align-items: center; gap: 8px">
          <Radio value="surface" variant="surface" :checked="true" />
          Surface
        </label>

        <label style="display: flex; align-items: center; gap: 8px">
          <Radio value="soft" variant="soft" :checked="true" />
          Soft
        </label>
      </div>
    </Variant>

    <Variant title="States">
      <div style="display: flex; flex-direction: column; gap: 12px">
        <label style="display: flex; align-items: center; gap: 8px">
          <Radio value="checked" :checked="true" />
          Checked
        </label>

        <label style="display: flex; align-items: center; gap: 8px">
          <Radio value="unchecked" :checked="false" />
          Unchecked
        </label>

        <label style="display: flex; align-items: center; gap: 8px">
          <Radio value="disabled" :checked="true" disabled />
          Disabled
        </label>
      </div>
    </Variant>

    <Variant title="Colors">
      <div style="display: flex; flex-direction: column; gap: 12px">
        <label style="display: flex; align-items: center; gap: 8px">
          <Radio value="indigo" color="indigo" :checked="true" />
          Indigo
        </label>

        <label style="display: flex; align-items: center; gap: 8px">
          <Radio value="green" color="green" :checked="true" />
          Green
        </label>

        <label style="display: flex; align-items: center; gap: 8px">
          <Radio value="red" color="red" :checked="true" />
          Red
        </label>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Radio } from "@components/ui/radio-group/index.js"
</script>
