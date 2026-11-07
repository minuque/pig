<template>
  <Story title="Segmented control">
    <Variant title="Sizes">
      <div style="display: flex; flex-direction: column; gap: 16px; align-items: flex-start">
        <SegmentedControl v-model="value" size="s">
          <SegmentedControlItem value="day">Day</SegmentedControlItem>
          <SegmentedControlItem value="week">Week</SegmentedControlItem>
          <SegmentedControlItem value="month">Month</SegmentedControlItem>
        </SegmentedControl>

        <SegmentedControl v-model="value" size="m">
          <SegmentedControlItem value="day">Day</SegmentedControlItem>
          <SegmentedControlItem value="week">Week</SegmentedControlItem>
          <SegmentedControlItem value="month">Month</SegmentedControlItem>
        </SegmentedControl>

        <SegmentedControl v-model="value" size="l">
          <SegmentedControlItem value="day">Day</SegmentedControlItem>
          <SegmentedControlItem value="week">Week</SegmentedControlItem>
          <SegmentedControlItem value="month">Month</SegmentedControlItem>
        </SegmentedControl>
      </div>
    </Variant>

    <Variant title="Variants">
      <div style="display: flex; flex-direction: column; gap: 16px; align-items: flex-start">
        <SegmentedControl v-model="value" variant="surface">
          <SegmentedControlItem value="day">Surface A</SegmentedControlItem>
          <SegmentedControlItem value="week">Surface B</SegmentedControlItem>
        </SegmentedControl>

        <SegmentedControl v-model="value" variant="classic">
          <SegmentedControlItem value="day">Classic A</SegmentedControlItem>
          <SegmentedControlItem value="week">Classic B</SegmentedControlItem>
        </SegmentedControl>
      </div>
    </Variant>

    <Variant title="Disabled">
      <SegmentedControl v-model="value" disabled>
        <SegmentedControlItem value="day">Day</SegmentedControlItem>
        <SegmentedControlItem value="week">Week</SegmentedControlItem>
      </SegmentedControl>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { ref } from "vue"
import { SegmentedControl, SegmentedControlItem } from "@components/ui/segmented-control/index.js"

const value = ref("day")
</script>
