<template>
  <Card size="s" variant="surface" class="md-image">
    <template #render="{ props: part }">
      <span v-bind="part">
        <img v-bind="$attrs" class="md-image-img" />
      </span>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { Card } from "@pig/ui/card"

defineOptions({ inheritAttrs: false })
</script>

<style scoped>
.md-image[data-slot="card"] {
  --card-padding: 0;
  --card-background-color: var(--bg);

  display: inline-block;
  max-width: 100%;
  vertical-align: middle;
}

.md-image-img {
  display: block;
  max-width: 100%;
  height: auto;
}
</style>
