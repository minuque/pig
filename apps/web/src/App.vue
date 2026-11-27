<template>
  <RouterView />
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"
import { provideUiLabels } from "@pig/ui"

const { t } = useI18n()

provideUiLabels(() => ({
  close: t("common.close"),
  navigate: t("common.navigate"),
  select: t("common.select"),
  notifications: t("common.notifications"),
  notificationsEmpty: t("common.notificationsEmpty"),
  openNotifications: t("common.openNotifications"),
  clearAll: t("common.clearAll"),
  dismiss: t("common.dismiss"),
  error: t("common.error"),
  justNow: t("common.justNow"),
}))
</script>
