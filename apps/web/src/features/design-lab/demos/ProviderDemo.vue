<template>
  <Story title="供应商">
    <Variant title="供应商列表">
      <ProviderList :providers="PROVIDERS" :loading="false" />
    </Variant>

    <Variant title="自定义模型卡片">
      <CustomModelCard v-model="model" provider-id="local-llm" provider-name="Local LLM" />
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { ref } from "vue"
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import CustomModelCard from "@features/settings/components/models/CustomModelCard.vue"
import ProviderList from "@features/settings/components/models/ProviderList.vue"
import { CUSTOM_MODEL, PROVIDERS } from "@features/design-lab/lib/fixtures.js"

const model = ref({ ...CUSTOM_MODEL })
</script>
