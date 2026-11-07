<template>
  <Story title="Dropdown menu">
    <Variant title="Default">
      <DropdownMenu :modal="false">
        <DropdownMenuTrigger as-child>
          <Button variant="soft">Open menu</Button>
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
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Variant>

    <Variant title="Open">
      <DropdownMenu :modal="false" default-open>
        <DropdownMenuTrigger as-child>
          <Button variant="soft">Always open</Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <DropdownMenuItem>First item</DropdownMenuItem>
          <DropdownMenuItem>Second item</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Destructive item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Variant>

    <Variant title="Sizes">
      <div style="display: flex; flex-wrap: wrap; gap: 12px">
        <DropdownMenu :modal="false">
          <DropdownMenuTrigger as-child>
            <Button variant="soft" size="s">Small</Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent size="s">
            <DropdownMenuItem>Item</DropdownMenuItem>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu :modal="false">
          <DropdownMenuTrigger as-child>
            <Button variant="soft" size="m">Medium</Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent size="m">
            <DropdownMenuItem>Item</DropdownMenuItem>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu :modal="false">
          <DropdownMenuTrigger as-child>
            <Button variant="soft" size="l">Large</Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent size="l">
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
import { Button } from "@components/ui/button/index.js"
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
} from "@components/ui/dropdown-menu/index.js"

const showHidden = ref(false)
const choice = ref("a")
</script>
