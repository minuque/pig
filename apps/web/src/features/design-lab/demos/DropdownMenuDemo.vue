<template>
  <Story title="Dropdown menu">
    <Variant title="Default">
      <DropdownMenu :modal="false">
        <DropdownMenuTrigger as-child>
          <Button variant="secondary">Open menu</Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem shortcut="Ctrl+R">Rename</DropdownMenuItem>
          <DropdownMenuItem shortcut="Ctrl+D">Duplicate</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem v-model="showHidden">Show hidden</DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />

          <DropdownMenuRadioGroup v-model="choice">
            <DropdownMenuRadioItem value="a">Option A</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="b">Option B</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <DropdownMenuItem color="danger">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Variant>

    <Variant title="Open">
      <DropdownMenu :modal="false" default-open>
        <DropdownMenuTrigger as-child>
          <Button variant="secondary">Always open</Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <DropdownMenuItem>First item</DropdownMenuItem>
          <DropdownMenuItem>Second item</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem color="danger">Danger item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Variant>

    <Variant title="Sizes">
      <div style="display: flex; flex-wrap: wrap; gap: 12px">
        <DropdownMenu :modal="false">
          <DropdownMenuTrigger as-child>
            <Button variant="secondary" size="s">Small</Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent size="s">
            <DropdownMenuItem>Item</DropdownMenuItem>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu :modal="false">
          <DropdownMenuTrigger as-child>
            <Button variant="secondary" size="m">Medium</Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent size="m">
            <DropdownMenuItem>Item</DropdownMenuItem>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { ref } from "vue"
import { Button } from "@pig/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@pig/ui/dropdown-menu"

const showHidden = ref(false)
const choice = ref("a")
</script>
