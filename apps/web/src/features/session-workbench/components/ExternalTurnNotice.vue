<template>
  <Banner v-if="externalTurn" class="external-turn" size="s">
    <template #icon><EyeIcon /></template>

    <div class="external-turn-row">
      <span>{{ t("session.externalTurnNotice") }}</span>

      <Button type="button" size="s" variant="secondary" @click="confirming = true">
        {{ t("session.takeover") }}
      </Button>
    </div>

    <p v-if="takeoverError" class="external-turn-error" role="alert">{{ takeoverError }}</p>
  </Banner>

  <AlertDialog v-model:open="confirming">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t("session.takeoverTitle") }}</AlertDialogTitle>
        <AlertDialogDescription>{{ t("session.takeoverBody") }}</AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter>
        <AlertDialogCancel>{{ t("common.cancel") }}</AlertDialogCancel>
        <AlertDialogAction @click="confirm">{{ t("session.takeoverConfirm") }}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue"
import { EyeIcon } from "@components/icons/index.js"
import { errorMessage } from "@client/http.js"
import { Button } from "@pig/ui/button"
import { Banner } from "@pig/ui/banner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@pig/ui/alert-dialog"
import { useI18n } from "@i18n/index.js"
import { useSession } from "@features/session/index.js"

const { t } = useI18n()
const { externalTurn, takeover } = useSession()
const confirming = ref(false)
const takeoverError = ref("")

watch(externalTurn, () => {
  takeoverError.value = ""
})

function confirm() {
  takeoverError.value = ""
  void takeover().catch((error) => {
    takeoverError.value = errorMessage(error)
  })
}
</script>

<style scoped>
.external-turn {
  margin-block-end: var(--space-xs);
}

.external-turn-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.external-turn-error {
  margin: var(--space-2xs) 0 0;
  color: var(--danger-text);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}
</style>
