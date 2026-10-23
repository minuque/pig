<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline">操作</Button>
    </DropdownMenuTrigger>

    <DropdownMenuContent>
      <DropdownMenuItem>复制</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive">删除</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { Button } from "@components/ui/button/index.js"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
</script>
