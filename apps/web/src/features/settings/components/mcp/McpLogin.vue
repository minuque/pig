<template>
  <Card size="m" class="mcp-login">
    <p class="login-status" :data-state="phase">
      <LoaderIcon v-if="phase === 'running'" class="size-icon is-spinning" />
      {{ phase === "error" ? message : t("settings.mcp.loginWaiting") }}
    </p>

    <p v-if="phase === 'running' && progress" class="login-note">{{ progress }}</p>

    <div class="login-actions">
      <Link v-if="url" :href="url" target="_blank" rel="noopener noreferrer">
        {{ t("settings.mcp.openAuth") }}
      </Link>

      <Button type="button" size="s" variant="ghost" @click="close">
        {{ phase === "running" ? t("common.cancel") : t("common.close") }}
      </Button>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue"

import { cancelMcpLogin, loginMcp, openMcpLoginEvents } from "@client/agent-config.js"
import { errorMessage } from "@client/http.js"
import { LoaderIcon } from "@components/icons/index.js"
import { useI18n } from "@i18n/index.js"
import { Button } from "@pig/ui/button"
import { Card } from "@pig/ui/card"
import { Link } from "@pig/ui/link"

const props = defineProps<{ scope: string; name: string }>()
const emit = defineEmits<{ done: []; close: [] }>()
const { t } = useI18n()
const phase = ref<"running" | "error">("running")
const url = ref<string>()
const progress = ref<string>()
const message = ref("")
const controller = new AbortController()
let loginId: string | undefined

onMounted(async () => {
  try {
    loginId = (await loginMcp(props.scope, props.name)).loginId
    await openMcpLoginEvents(
      loginId,
      (event) => {
        if (event.type === "auth_url") url.value = event.url
        else if (event.type === "progress") progress.value = event.message
        else if (event.type === "done") emit("done")
        else if (event.type === "error") {
          phase.value = "error"
          message.value = event.message
        }
      },
      controller.signal,
    )
  } catch (cause) {
    if (controller.signal.aborted) return
    phase.value = "error"
    message.value = errorMessage(cause)
  }
})

function close() {
  if (loginId && phase.value === "running") void cancelMcpLogin(loginId)
  emit("close")
}

onBeforeUnmount(() => controller.abort())
</script>

<style scoped>
.mcp-login {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.login-status {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin: 0;
  color: var(--fg);
  font-size: var(--text-body);
}

.login-status[data-state="error"] {
  color: var(--danger-text);
}

.login-note {
  margin: 0;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

.login-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}
</style>
