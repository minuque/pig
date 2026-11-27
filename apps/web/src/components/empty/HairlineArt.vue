<template>
  <div ref="host" class="hairline-art" :data-figure="figure"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from "vue"
import type { Figure } from "@lucasmarkes/hairline"

export type HairlineFigure = "plug" | "basket" | "drawer" | "hub" | "stack" | "query"

const props = defineProps<{ figure: HairlineFigure }>()
const host = useTemplateRef("host")
let mounted: Figure | undefined
let disposed = false

onMounted(async () => {
  const figures = await import("@lucasmarkes/hairline")

  if (disposed || !host.value) return
  mounted = figures[props.figure](host.value)
})

onBeforeUnmount(() => {
  disposed = true
  mounted?.destroy()
})
</script>

<style scoped>
.hairline-art {
  inline-size: 120px;
  aspect-ratio: 5 / 4;
}

.hairline-art[data-figure="query"] {
  inline-size: 80px;
}

@media (prefers-reduced-motion: reduce) {
  .hairline-art {
    pointer-events: none;
  }
}
</style>
