<template>
  <Story title="CommandPalette">
    <Variant title="Default">
      <Button variant="outline" @click="open = true">Open palette</Button>

      <CommandPalette v-model:open="open" v-model:query="query" title="Commands">
        <CommandPaletteInput placeholder="Type a command" />
        <CommandPaletteEmpty>No results found</CommandPaletteEmpty>

        <CommandPaletteList>
          <CommandPaletteGroup>
            <CommandPaletteGroupLabel>Actions</CommandPaletteGroupLabel>

            <CommandPaletteItem
              v-for="item in matches"
              :key="item"
              :value="item"
              @select="open = false"
            >
              <template #icon><SquareCodeIcon class="size-icon" /></template>
              {{ item }}
            </CommandPaletteItem>
          </CommandPaletteGroup>
        </CommandPaletteList>
      </CommandPalette>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Button } from "@pig/ui/button"
import { SquareCodeIcon } from "@components/icons/index.js"
import {
  CommandPalette,
  CommandPaletteEmpty,
  CommandPaletteGroup,
  CommandPaletteGroupLabel,
  CommandPaletteInput,
  CommandPaletteItem,
  CommandPaletteList,
} from "@pig/ui/command-palette"

const ITEMS = ["New session", "Open project", "Toggle sidebar", "Settings", "Switch model"]
const open = ref(false)
const query = ref("")
const matches = computed(() =>
  ITEMS.filter((item) => item.toLowerCase().includes(query.value.toLowerCase())),
)
</script>
