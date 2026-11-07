<template>
  <Story title="轮次提示">
    <Variant title="出错、中断、重试">
      <div style="display: flex; flex-direction: column; gap: 12px">
        <TurnErrorRow :error="true" message="429 Too Many Requests: rate limit exceeded" />
        <TurnErrorRow :error="false" />
        <TurnErrorRow :error="true" message="upstream timeout" :retry-count="3" />
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import TurnErrorRow from "@features/transcript-view/components/TurnErrorRow.vue"
</script>
