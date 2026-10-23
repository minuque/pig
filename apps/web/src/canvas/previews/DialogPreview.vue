<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button variant="outline">重命名</Button>
    </DialogTrigger>

    <DialogContent>
      <DialogTitle>重命名</DialogTitle>
      <input v-model="draft" class="dialog-field" type="text" aria-label="名称" />
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { shallowRef } from "vue"
import { Button } from "@components/ui/button/index.js"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@components/ui/dialog/index.js"

const open = shallowRef(false)
const draft = shallowRef("草稿")
</script>

<style scoped>
.dialog-field {
  width: 100%;
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  padding: var(--spacing-xs) var(--spacing-sm);
}
</style>
