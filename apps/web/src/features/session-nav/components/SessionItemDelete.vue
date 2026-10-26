<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent class="delete-dialog">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t("session.deleteTitle") }}</AlertDialogTitle>
        <AlertDialogDescription>{{ t("session.deleteBody", { title }) }}</AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter>
        <AlertDialogCancel>{{ t("common.cancel") }}</AlertDialogCancel>

        <AlertDialogAction variant="destructive" @click="emit('confirm')">
          {{ t("session.deleteTitle") }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"
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

const { t } = useI18n()
const open = defineModel<boolean>("open", { default: false })
const emit = defineEmits<{
  confirm: []
}>()
</script>

<style scoped>
/* 比默认弹层窄一档，宽屏下也不会拉成整行 */
@media (min-width: 640px) {
  .delete-dialog {
    max-inline-size: 28rem;
  }
}
</style>
