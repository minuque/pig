<template>
  <Story title="Context menu">
    <Variant title="Default">
      <ContextMenu>
        <ContextMenuTrigger as-child>
          <div
            style="
              display: flex;
              align-items: center;
              justify-content: center;
              inline-size: 320px;
              block-size: 160px;
              border: 1px dashed var(--gray-a7);
              border-radius: var(--radius-3);
            "
          >
            Right-click this area
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent>
          <ContextMenuLabel>Actions</ContextMenuLabel>
          <ContextMenuItem shortcut="Ctrl+C">Copy</ContextMenuItem>
          <ContextMenuItem shortcut="Ctrl+V">Paste</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuCheckboxItem v-model="bookmarked">Bookmark</ContextMenuCheckboxItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive">Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </Variant>

    <Variant title="Sizes">
      <div style="display: flex; flex-wrap: wrap; gap: 16px">
        <ContextMenu>
          <ContextMenuTrigger as-child>
            <div style="padding: 24px; border: 1px dashed var(--gray-a7)">Small menu</div>
          </ContextMenuTrigger>

          <ContextMenuContent size="s">
            <ContextMenuItem>Item</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        <ContextMenu>
          <ContextMenuTrigger as-child>
            <div style="padding: 24px; border: 1px dashed var(--gray-a7)">Medium menu</div>
          </ContextMenuTrigger>

          <ContextMenuContent size="m">
            <ContextMenuItem>Item</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        <ContextMenu>
          <ContextMenuTrigger as-child>
            <div style="padding: 24px; border: 1px dashed var(--gray-a7)">Large menu</div>
          </ContextMenuTrigger>

          <ContextMenuContent size="l">
            <ContextMenuItem>Item</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { ref } from "vue"
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./index.js"

const bookmarked = ref(false)
</script>
