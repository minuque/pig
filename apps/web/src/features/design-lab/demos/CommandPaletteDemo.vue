<template>
  <Story title="CommandPalette">
    <Variant title="Default">
      <Button variant="surface" @click="open = true">Open palette</Button>

      <CommandPalette v-model:open="open" title="Commands">
        <CommandPaletteInput v-model="query" placeholder="Type a command" />

        <CommandPaletteList>
          <CommandPaletteEmpty v-if="!matches.length">No results found</CommandPaletteEmpty>

          <CommandPaletteItem
            v-for="item in matches"
            :key="item"
            :value="item"
            @select="open = false"
          >
            {{ item }}
          </CommandPaletteItem>
        </CommandPaletteList>
      </CommandPalette>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Button } from "@components/ui/button/index.js"
import {
  CommandPalette,
  CommandPaletteEmpty,
  CommandPaletteInput,
  CommandPaletteItem,
  CommandPaletteList,
} from "@components/ui/command-palette/index.js"

const ITEMS = ["New session", "Open project", "Toggle sidebar", "Settings", "Switch model"]
const open = ref(false)
const query = ref("")
const matches = computed(() =>
  ITEMS.filter((item) => item.toLowerCase().includes(query.value.toLowerCase())),
)
</script>
