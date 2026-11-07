<template>
  <Story title="RadioGroup">
    <Variant title="Sizes">
      <div style="display: flex; flex-direction: column; gap: 16px">
        <RadioGroup v-model="value" size="s">
          <RadioGroupItem value="a">Small A</RadioGroupItem>
          <RadioGroupItem value="b">Small B</RadioGroupItem>
        </RadioGroup>

        <RadioGroup v-model="value" size="m">
          <RadioGroupItem value="a">Medium A</RadioGroupItem>
          <RadioGroupItem value="b">Medium B</RadioGroupItem>
        </RadioGroup>

        <RadioGroup v-model="value" size="l">
          <RadioGroupItem value="a">Large A</RadioGroupItem>
          <RadioGroupItem value="b">Large B</RadioGroupItem>
        </RadioGroup>
      </div>
    </Variant>

    <Variant title="Variants">
      <div style="display: flex; flex-direction: column; gap: 16px">
        <RadioGroup v-model="value" variant="classic">
          <RadioGroupItem value="a">Classic A</RadioGroupItem>
          <RadioGroupItem value="b">Classic B</RadioGroupItem>
        </RadioGroup>

        <RadioGroup v-model="value" variant="surface">
          <RadioGroupItem value="a">Surface A</RadioGroupItem>
          <RadioGroupItem value="b">Surface B</RadioGroupItem>
        </RadioGroup>

        <RadioGroup v-model="value" variant="soft">
          <RadioGroupItem value="a">Soft A</RadioGroupItem>
          <RadioGroupItem value="b">Soft B</RadioGroupItem>
        </RadioGroup>
      </div>
    </Variant>

    <Variant title="Disabled">
      <RadioGroup v-model="value" disabled>
        <RadioGroupItem value="a">Option A</RadioGroupItem>
        <RadioGroupItem value="b">Option B</RadioGroupItem>
      </RadioGroup>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { ref } from "vue"
import { RadioGroup, RadioGroupItem } from "@components/ui/radio-group/index.js"

const value = ref("a")
</script>
