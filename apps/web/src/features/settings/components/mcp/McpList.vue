<template>
  <section class="mcp-list">
    <ScopeToolbar
      :label="t('settings.mcp.title')"
      :add-label="t('settings.mcp.add')"
      :scope="scope"
      :workspace="workspace"
      :query="query"
      @update:scope="emit('update:scope', $event)"
      @update:query="query = $event"
      @add="emit('add')"
    />

    <EmptyState
      v-if="state.error.value && !state.view.value"
      class="list-empty"
      :title="t('settings.mcp.loadFailedTitle')"
      :description="t('settings.mcp.loadFailedBody')"
      :detail="state.error.value"
    >
      <template #art><HairlineArt figure="plug" /></template>
      <template #actions><RetryButton :action="state.refresh" /></template>
    </EmptyState>

    <p v-else-if="state.error.value" class="list-note">{{ state.error.value }}</p>

    <Banner v-if="state.note.value" color="warning" variant="surface" size="s">
      {{ state.note.value }}
    </Banner>

    <section v-if="servers.length || invalid.length" class="mcp-group">
      <h3 class="group-path">{{ state.view.value?.file }}</h3>

      <CardList>
        <CardRow v-for="server in servers" :key="server.name" interactive class="mcp-row">
          <button type="button" class="row-open" @click="emit('open', server.name)">
            <span class="row-main">
              <span class="row-name">
                {{ server.name }}

                <Badge v-if="server.override" size="s" variant="soft" color="info">
                  {{ t("settings.mcp.override") }}
                </Badge>

                <StatusIndicator
                  :status="tone(state.statusOf(server))"
                  size="s"
                  :label="t(`settings.mcp.status.${state.statusOf(server)}`)"
                />
              </span>

              <span class="row-sub">{{ summary(server) }}</span>
            </span>
          </button>

          <Switch
            :model-value="server.enabled"
            size="s"
            :aria-label="server.name"
            @update:model-value="state.setEnabled(server, $event)"
          />

          <ChevronRightIcon class="row-chevron" />
        </CardRow>

        <CardRow v-for="entry in invalid" :key="`invalid-${entry.name}`" class="mcp-row">
          <span class="row-main row-static">
            <span class="row-name">
              {{ entry.name }}
              <Badge size="s" variant="soft" color="warning">{{ t("settings.mcp.invalid") }}</Badge>
            </span>

            <span class="row-sub">{{ entry.message }}</span>
          </span>
        </CardRow>
      </CardList>
    </section>

    <EmptyState
      v-else-if="state.view.value && !query.trim()"
      class="list-empty"
      :title="t('settings.mcp.emptyTitle')"
      :description="t('settings.mcp.emptyBody')"
    >
      <template #art><HairlineArt figure="hub" /></template>
    </EmptyState>

    <EmptyState
      v-else-if="state.view.value && !inherited.length"
      class="list-empty"
      live
      :title="t('settings.mcp.noMatch', { query: query.trim() })"
      :description="t('settings.mcp.noMatchBody')"
    >
      <template #art><HairlineArt figure="query" /></template>

      <template #actions>
        <Button type="button" variant="secondary" color="neutral" @click="query = ''">
          {{ t("common.clearSearch") }}
        </Button>
      </template>
    </EmptyState>

    <Collapsible v-if="inherited.length" v-model:open="inheritedOpen">
      <CollapsibleTrigger>
        <template #render="{ props: part }">
          <button v-bind="part" type="button" class="fold-trigger">
            <ChevronRightIcon class="fold-chevron" :data-open="inheritedOpen ? '' : undefined" />
            {{ t("settings.mcp.inheritedMore", { count: inherited.length }) }}
          </button>
        </template>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <CardList class="fold-body">
          <CardRow v-for="server in inherited" :key="server.name" interactive class="mcp-row">
            <button type="button" class="row-open" @click="emit('open', server.name)">
              <span class="row-main">
                <span class="row-name">{{ server.name }}</span>

                <span class="row-sub">
                  {{ server.enabled ? t("settings.mcp.enabled") : t("settings.mcp.disabled") }}
                </span>
              </span>
            </button>

            <ChevronRightIcon class="row-chevron" />
          </CardRow>
        </CardList>
      </CollapsibleContent>
    </Collapsible>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import type { McpServerView } from "@pig/protocol"

import { ChevronRightIcon } from "@components/icons/index.js"
import ScopeToolbar from "@features/settings/components/ScopeToolbar.vue"
import type { McpState, McpStatus } from "@features/settings/hooks/use-mcp.js"
import { joinArgs, searchText } from "@features/settings/lib/mcp-draft.js"
import { useI18n } from "@i18n/index.js"
import HairlineArt from "@components/empty/HairlineArt.vue"
import RetryButton from "@components/empty/RetryButton.vue"
import { Badge } from "@pig/ui/badge"
import { Banner } from "@pig/ui/banner"
import { Button } from "@pig/ui/button"
import { EmptyState } from "@pig/ui/empty-state"
import { CardList, CardRow } from "@pig/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@pig/ui/collapsible"
import { StatusIndicator, type StatusTone } from "@pig/ui/status-indicator"
import { Switch } from "@pig/ui/switch"

const props = defineProps<{ state: McpState; scope: string; workspace: string | undefined }>()
const emit = defineEmits<{ "update:scope": [scope: string]; open: [name: string]; add: [] }>()
const { t } = useI18n()
const query = ref("")
const inheritedOpen = ref(false)

function matches(name: string, extra: string) {
  const q = query.value.trim().toLowerCase()
  return !q || `${name} ${extra}`.toLowerCase().includes(q)
}

function summary(server: McpServerView) {
  const { config } = server
  const command =
    typeof config.command === "string" ? `${config.command} ${joinArgs(config.args)}` : ""
  return String(config.description ?? "") || command.trim() || String(config.url ?? "")
}

const servers = computed(() =>
  (props.state.view.value?.servers ?? []).filter((s) => matches(s.name, searchText(s.config))),
)
const inherited = computed(() =>
  (props.state.view.value?.inherited ?? []).filter((s) => matches(s.name, searchText(s.config))),
)
const invalid = computed(() =>
  (props.state.view.value?.invalid ?? []).filter((entry) => matches(entry.name, entry.message)),
)

function tone(status: McpStatus): StatusTone {
  const tones: Record<McpStatus, StatusTone> = {
    idle: "idle",
    probing: "running",
    connected: "success",
    needsAuth: "warning",
    failed: "error",
    disabled: "idle",
  }
  return tones[status]
}
</script>

<style scoped>
.mcp-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.mcp-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.group-path {
  margin: 0;
  padding-inline: var(--space-md);
  color: var(--fg-muted);
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-normal);
}

.mcp-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.row-open {
  display: flex;
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.row-main {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  padding-block: var(--space-xs);
}

.row-name {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--fg);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
}

.row-sub {
  overflow: hidden;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-chevron,
.fold-chevron {
  flex: none;
  color: var(--fg-muted);
}

.fold-chevron {
  transition: transform var(--duration-fast) var(--ease-out);
}

.fold-chevron[data-open] {
  transform: rotate(90deg);
}

.fold-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-md);
  border: 0;
  background: none;
  color: var(--fg-secondary);
  font: inherit;
  font-size: var(--text-meta);
  cursor: pointer;
}

.fold-trigger:hover {
  color: var(--fg);
}

.fold-body {
  margin-block-start: var(--space-xs);
}

.list-empty {
  padding-block: var(--space-2xl);
}

.list-note {
  margin: 0;
  padding-inline: var(--space-md);
  color: var(--fg-muted);
  font-size: var(--text-meta);
}
</style>
