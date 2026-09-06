<template>
  <span class="morph-label motion-label-width" :style="{ width: width ? `${width}px` : undefined }">
    <span ref="measure" class="measure" aria-hidden="true">{{ text }}</span>
    <Transition name="label-swap">
      <span :key="text" class="label">{{ text }}</span>
    </Transition>
  </span>
</template>

<script setup lang="ts">
import { useElementSize } from "@vueuse/core"
import { useTemplateRef } from "vue"

defineProps<{ text: string }>()

const measure = useTemplateRef<HTMLElement>("measure")
const { width } = useElementSize(measure)
</script>

<style scoped>
.morph-label {
  position: relative;
  display: inline-block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  vertical-align: bottom;
}

.measure {
  display: inline-block;
  visibility: hidden;
  white-space: nowrap;
}

.label {
  position: absolute;
  inset: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
