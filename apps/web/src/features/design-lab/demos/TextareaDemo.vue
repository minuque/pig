<template>
  <Story title="Textarea">
    <Variant title="Sizes">
      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 320px">
        <Textarea v-model="value" size="s" rows="2" placeholder="Small" />
        <Textarea v-model="value" size="m" rows="2" placeholder="Medium" />
      </div>
    </Variant>

    <Variant title="Variants">
      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 320px">
        <Textarea v-model="value" variant="surface" rows="2" placeholder="Surface" />
        <Textarea v-model="value" variant="soft" rows="2" placeholder="Soft" />
      </div>
    </Variant>

    <Variant title="AutoResize & States">
      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 320px">
        <Textarea v-model="autoText" auto-resize rows="1" placeholder="Auto resize..." />
        <Textarea model-value="Invalid content" invalid rows="2" />
        <Textarea model-value="Readonly content" readonly rows="2" />
        <Textarea model-value="Disabled content" disabled rows="2" />
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { ref } from "vue"
import { Textarea } from "@pig/ui/textarea"

const value = ref("")
const autoText = ref("第一行\n第二行")
</script>
