<template>
  <Banner
    v-if="reconnecting || reconnectFailed"
    class="workbench-banner"
    :color="reconnectFailed ? 'danger' : 'warning'"
    size="s"
  >
    <div class="workbench-banner-row">
      <span>
        {{ t(reconnectFailed ? "session.disconnectedFailed" : "session.disconnectedReconnecting") }}
      </span>

      <Button
        v-if="reconnectFailed"
        type="button"
        size="s"
        variant="secondary"
        @click="reconnectNow"
      >
        {{ t("session.reconnect") }}
      </Button>
    </div>
  </Banner>

  <Banner v-if="historyError && sessionId" class="workbench-banner" color="danger" size="s">
    <div class="workbench-banner-row">
      <span>{{ t("session.historyRefreshFailed") }}</span>

      <Button type="button" size="s" variant="secondary" @click="retryHistory">
        {{ t("common.retry") }}
      </Button>
    </div>
  </Banner>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"
import { Banner } from "@pig/ui/banner"
import { Button } from "@pig/ui/button"
import { useSession } from "@features/session/index.js"

const { t } = useI18n()
const { sessionId, reconnecting, reconnectFailed, reconnectNow, historyError, retryHistory } =
  useSession()
</script>

<style scoped>
.workbench-banner {
  margin: var(--space-xs) var(--space-md) 0;
}

.workbench-banner-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}
</style>
