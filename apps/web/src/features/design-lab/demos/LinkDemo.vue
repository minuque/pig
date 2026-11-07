<template>
  <Story title="Link">
    <Variant title="Sizes">
      <div style="display: flex; flex-direction: column; gap: 8px">
        <Link href="#" size="s" @click.prevent>Small link</Link>
        <Link href="#" size="m" @click.prevent>Medium link</Link>
        <Link href="#" size="l" @click.prevent>Large link</Link>
      </div>
    </Variant>

    <Variant title="Weights">
      <div style="display: flex; flex-direction: column; gap: 8px">
        <Link href="#" weight="regular" @click.prevent>Regular</Link>
        <Link href="#" weight="medium" @click.prevent>Medium</Link>
        <Link href="#" weight="bold" @click.prevent>Bold</Link>
      </div>
    </Variant>

    <Variant title="Underline">
      <div style="display: flex; flex-direction: column; gap: 8px">
        <Link href="#" underline="auto" @click.prevent>Auto</Link>
        <Link href="#" underline="always" @click.prevent>Always</Link>
        <Link href="#" underline="hover" @click.prevent>Hover</Link>
        <Link href="#" underline="none" @click.prevent>None</Link>
      </div>
    </Variant>

    <Variant title="Color and truncate">
      <div style="display: flex; flex-direction: column; gap: 8px">
        <Link href="#" color="indigo" @click.prevent>Indigo</Link>
        <Link href="#" color="red" @click.prevent>Red</Link>

        <div style="max-width: 200px">
          <Link href="#" truncate @click.prevent>
            A long link label that should be truncated with an ellipsis
          </Link>
        </div>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Link } from "@components/ui/link/index.js"
</script>
