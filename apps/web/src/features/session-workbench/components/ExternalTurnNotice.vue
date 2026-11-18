<template>
  <Callout v-if="externalTurn" class="external-turn" size="s">
    <template #icon><EyeIcon /></template>

    <div class="external-turn-row">
      <span>{{ t("session.externalTurnNotice") }}</span>

      <Button type="button" size="s" variant="soft" @click="confirming = true">
        {{ t("session.takeover") }}
      </Button>
    </div>
  </Callout>

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
import { ref } from "vue"
import { notifyAction } from "@components/layout/notify.js"
import { EyeIcon } from "@components/icons/index.js"
import { errorMessage } from "@client/http.js"
import { Button } from "@components/ui/button/index.js"
import { Callout } from "@components/ui/callout/index.js"
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
import { useI18n } from "@i18n/index.js"
import { useSession } from "@features/session/index.js"

const { t } = useI18n()
const { externalTurn, takeover } = useSession()
const confirming = ref(false)

function confirm() {
  void takeover().catch((error) => notifyAction(errorMessage(error)))
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
</style>
