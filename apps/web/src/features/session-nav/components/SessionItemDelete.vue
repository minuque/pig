<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent class="sm:max-w-[28rem]">
      <AlertDialogHeader>
        <AlertDialogTitle>删除会话</AlertDialogTitle>
        <AlertDialogDescription>确定删除“{{ title }}”吗？此操作不可恢复。</AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter>
        <AlertDialogCancel>取消</AlertDialogCancel>

        <AlertDialogAction variant="destructive" @click="emit('confirm')">
          删除会话
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@components/ui/alert-dialog/index.js"

defineProps<{
  title: string
}>()

const open = defineModel<boolean>("open", { default: false })

const emit = defineEmits<{
  confirm: []
}>()
</script>
