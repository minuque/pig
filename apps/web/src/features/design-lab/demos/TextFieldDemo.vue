<template>
  <Story title="TextField">
    <Variant title="Sizes">
      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 320px">
        <TextFieldRoot v-model="value" size="s" placeholder="Small" />
        <TextFieldRoot v-model="value" size="m" placeholder="Medium" />
        <TextFieldRoot v-model="value" size="l" placeholder="Large" />
      </div>
    </Variant>

    <Variant title="Variants">
      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 320px">
        <TextFieldRoot v-model="value" variant="classic" placeholder="Classic" />
        <TextFieldRoot v-model="value" variant="surface" placeholder="Surface" />
        <TextFieldRoot v-model="value" variant="soft" placeholder="Soft" />
      </div>
    </Variant>

    <Variant title="With slots">
      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 320px">
        <TextFieldRoot v-model="search" placeholder="Search">
          <TextFieldSlot side="left"><MagnifierIcon /></TextFieldSlot>
        </TextFieldRoot>

        <TextFieldRoot v-model="value" placeholder="Amount">
          <TextFieldSlot side="right">kg</TextFieldSlot>
        </TextFieldRoot>
      </div>
    </Variant>

    <Variant title="States">
      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 320px">
        <TextFieldRoot v-model="value" placeholder="Default" />
        <TextFieldRoot model-value="Read only" readonly placeholder="Read only" />
        <TextFieldRoot model-value="Disabled" disabled placeholder="Disabled" />
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { ref } from "vue"
import { MagnifierIcon } from "@components/icons/index.js"
import { TextFieldRoot, TextFieldSlot } from "@components/ui/text-field/index.js"

const value = ref("")
const search = ref("")
</script>
