<template>
  <section class="mcp-detail">
    <header class="detail-head">
      <h2 class="detail-title">
        {{ server.name }}

        <Badge v-if="server.override" size="s" variant="soft" color="info">
          {{ t("settings.mcp.override") }}
        </Badge>

        <StatusIndicator
          :status="tone"
          size="s"
          :label="t(`settings.mcp.status.${state.statusOf(server)}`)"
        />
      </h2>

      <p class="detail-mono">{{ target }}</p>
      <p v-if="description" class="detail-desc">{{ description }}</p>
    </header>

    <div class="detail-actions">
      <Button
        v-if="server.enabled"
        type="button"
        size="s"
        :loading="state.probing.value"
        @click="state.probe()"
      >
        <RefreshCwIcon class="size-icon-sm" />
        {{ probe?.status === "connected" ? t("settings.mcp.refresh") : t("settings.mcp.probe") }}
      </Button>

      <Button v-if="inherited" type="button" size="s" variant="outline" @click="emit('jumpGlobal')">
        {{ t("settings.mcp.jumpGlobal") }}
      </Button>

      <template v-else>
        <Button
          v-if="oauth === 'logout'"
          type="button"
          size="s"
          variant="outline"
          @click="state.logout(server)"
        >
          {{ t("settings.mcp.logout") }}
        </Button>

        <Button
          v-else-if="oauth === 'login'"
          type="button"
          size="s"
          variant="outline"
          @click="loggingIn = true"
        >
          {{ t("settings.mcp.login") }}
        </Button>

        <Button
          v-if="!server.override"
          type="button"
          size="s"
          variant="outline"
          @click="emit('edit')"
        >
          {{ t("settings.mcp.edit") }}
        </Button>

        <Button type="button" size="s" variant="outline" color="danger" @click="confirming = true">
          {{ server.override ? t("settings.mcp.restore") : t("settings.mcp.delete") }}
        </Button>
      </template>
    </div>

    <McpLogin
      v-if="loggingIn"
      :scope="scope"
      :name="server.name"
      @done="onSignedIn"
      @close="loggingIn = false"
    />

    <Banner v-if="state.note.value && !probe" color="warning" variant="surface" size="s">
      {{ state.note.value }}
    </Banner>

    <Banner
      v-if="probe?.status === 'failed' || probe?.status === 'needs-auth'"
      color="warning"
      variant="surface"
    >
      <template #icon><TriangleAlertIcon /></template>
      <template #title>{{ t(`settings.mcp.status.${state.statusOf(server)}`) }}</template>
      <pre v-if="probe.error" class="detail-error">{{ probe.error }}</pre>
    </Banner>

    <CardList>
      <CardRow class="detail-setting">
        <span class="setting-copy">
          <span class="setting-title">{{ t("settings.mcp.exposure") }}</span>
          <span class="setting-desc">{{ t(`settings.mcp.exposureHint.${server.exposure}`) }}</span>
        </span>

        <Select
          size="s"
          :model-value="server.exposure"
          :disabled="inherited"
          @update:model-value="state.setExposure(server, $event as McpExposure)"
        >
          <SelectTrigger :aria-label="t('settings.mcp.exposure')">
            {{ server.exposure }}
          </SelectTrigger>

          <SelectContent>
            <SelectItem v-for="option in EXPOSURES" :key="option" :value="option">
              {{ option }}
            </SelectItem>
          </SelectContent>
        </Select>
      </CardRow>
    </CardList>

    <section class="detail-section">
      <h3 class="section-title">
        {{
          probe?.tools.length
            ? t("settings.mcp.toolsCount", { count: probe.tools.length })
            : t("settings.mcp.tools")
        }}
      </h3>

      <CardList v-if="probe?.tools.length">
        <div class="tool-list">
          <CardRow v-for="tool in probe.tools" :key="tool" class="tool-row">{{ tool }}</CardRow>
        </div>
      </CardList>

      <p v-else class="section-note">{{ t("settings.mcp.toolsEmpty") }}</p>
    </section>

    <section v-if="rules.length" class="detail-section">
      <h3 class="section-title">{{ t("settings.mcp.rules") }}</h3>

      <CardList>
        <CardRow v-for="[pattern, value] in rules" :key="pattern" class="detail-setting">
          <span class="tool-row">{{ pattern }}</span>
          <span class="setting-desc">{{ value }}</span>
        </CardRow>
      </CardList>
    </section>

    <AlertDialog v-model:open="confirming">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{
              server.override
                ? t("settings.mcp.restoreTitle", { name: server.name })
                : t("settings.mcp.deleteTitle", { name: server.name })
            }}
          </AlertDialogTitle>

          <AlertDialogDescription>
            {{
              server.override
                ? t("settings.mcp.restoreBody")
                : t("settings.mcp.deleteBody", { file: state.view.value?.file ?? "" })
            }}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{{ t("common.cancel") }}</AlertDialogCancel>

          <AlertDialogAction color="danger" @click="onDelete">
            {{ server.override ? t("settings.mcp.restore") : t("settings.mcp.delete") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { RefreshCwIcon } from "@lucide/vue"
import type { McpExposure, McpServerView } from "@pig/protocol"

import { TriangleAlertIcon } from "@components/icons/index.js"
import McpLogin from "@features/settings/components/mcp/McpLogin.vue"
import type { McpState } from "@features/settings/hooks/use-mcp.js"
import { EXPOSURES, joinArgs, oauthAction } from "@features/settings/lib/mcp-draft.js"
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
} from "@pig/ui/alert-dialog"
import { Badge } from "@pig/ui/badge"
import { Banner } from "@pig/ui/banner"
import { Button } from "@pig/ui/button"
import { CardList, CardRow } from "@pig/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@pig/ui/select"
import { StatusIndicator, type StatusTone } from "@pig/ui/status-indicator"

const TONES = {
  idle: "idle",
  probing: "running",
  connected: "success",
  needsAuth: "warning",
  failed: "error",
  disabled: "idle",
} as const satisfies Record<string, StatusTone>
const props = defineProps<{
  state: McpState
  server: McpServerView
  scope: string
  inherited: boolean
}>()
const emit = defineEmits<{ edit: []; removed: []; jumpGlobal: [] }>()
const { t } = useI18n()
const confirming = ref(false)
const loggingIn = ref(false)
const probe = computed(() => props.state.probes.value[props.server.name])
const oauth = computed(() => oauthAction(props.server, probe.value))
const tone = computed(() => TONES[props.state.statusOf(props.server)])
const description = computed(() => String(props.server.config.description ?? ""))
const rules = computed(() =>
  Object.entries((props.server.config.toolExposure ?? {}) as Record<string, string>),
)
const target = computed(() => {
  const { config } = props.server
  return typeof config.command === "string"
    ? `${config.command} ${joinArgs(config.args)}`.trim()
    : String(config.url ?? "")
})

async function onDelete() {
  if (await props.state.remove(props.server)) emit("removed")
}

async function onSignedIn() {
  loggingIn.value = false
  await props.state.probe()
}
</script>

<style scoped>
.mcp-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.detail-head {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.detail-title {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin: 0;
  color: var(--fg);
  font-size: var(--text-title);
  font-weight: var(--font-weight-semibold);
}

.detail-mono,
.detail-desc,
.setting-desc,
.section-note {
  margin: 0;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

.detail-mono,
.tool-row,
.detail-error {
  font-family: var(--font-mono);
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.detail-error {
  margin: 0;
  font-size: var(--text-meta);
  white-space: pre-wrap;
}

.detail-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding-block: var(--space-sm);
}

.setting-copy,
.detail-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.setting-title {
  color: var(--fg);
  font-size: var(--text-body);
}

.section-title {
  margin: 0;
  padding-inline: var(--space-md);
  color: var(--fg-secondary);
  font-size: var(--text-body);
  font-weight: var(--font-weight-semibold);
}

.section-note {
  padding-inline: var(--space-md);
}

.tool-list {
  max-block-size: 20rem;
  overflow-y: auto;
  border-radius: inherit;
}

.tool-row {
  padding-block: var(--space-xs);
  color: var(--fg);
  font-size: var(--text-meta);
}
</style>
