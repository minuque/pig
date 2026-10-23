<template>
  <ContextMenu>
    <ContextMenuTrigger>
      <div class="context-scroll">
        <p v-for="line in lines" :key="line">右键此区域 · {{ line }}</p>
      </div>
    </ContextMenuTrigger>

    <ContextMenuContent>
      <ContextMenuItem>复制</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive">删除</ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>

<script setup lang="ts">
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@components/ui/context-menu/index.js"

const lines = [1, 2, 3, 4, 5, 6]
</script>

<style scoped>
.context-scroll {
  width: 100%;
  max-height: 72px;
  overflow: auto;
  overscroll-behavior: contain;
  color: var(--foreground-muted);
  font-size: var(--text-eyebrow);
}
</style>
