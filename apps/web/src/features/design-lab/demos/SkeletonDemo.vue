<template>
  <Story title="Skeleton">
    <Variant title="Blocks">
      <div style="display: flex; flex-direction: column; gap: 8px">
        <Skeleton width="240px" height="16px" />
        <Skeleton width="180px" height="16px" />
        <Skeleton width="120px" height="16px" />
      </div>
    </Variant>

    <Variant title="Card placeholder">
      <div style="display: flex; gap: 12px; align-items: center">
        <Skeleton width="40px" height="40px" />

        <div style="display: flex; flex-direction: column; gap: 8px">
          <Skeleton width="160px" height="14px" />
          <Skeleton width="220px" height="14px" />
        </div>
      </div>
    </Variant>

    <Variant title="Content">
      <Skeleton :loading="false" width="240px">
        Content renders normally when loading is false.
      </Skeleton>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Skeleton } from "@components/ui/skeleton/index.js"
</script>
