<template>
  <Story title="IconButton">
    <Variant title="Variants">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
        <IconButton
          v-for="variant in VARIANTS"
          :key="variant"
          :variant="variant"
          :aria-label="variant"
        >
          <CopyIcon class="size-icon" />
        </IconButton>
      </div>
    </Variant>

    <Variant title="Sizes">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
        <IconButton
          v-for="size in SIZES"
          :key="size"
          :size="size"
          variant="ghost"
          color="neutral"
          :aria-label="size"
        >
          <CopyIcon class="size-icon" />
        </IconButton>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { IconButton } from "@pig/ui/button"
import { CopyIcon } from "@components/icons/index.js"

const VARIANTS = ["solid", "secondary", "outline", "ghost"] as const
const SIZES = ["s", "m"] as const
</script>
