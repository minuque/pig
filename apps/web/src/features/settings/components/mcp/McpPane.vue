<template>
  <section class="pane">
    <McpServerForm
      v-if="view === 'create' || (view === 'edit' && current)"
      :key="view === 'edit' ? (current?.name ?? '') : 'create'"
      :state="state"
      :scope="scope"
      :server="view === 'edit' ? current : undefined"
      @saved="onSaved"
      @cancel="view = view === 'edit' ? 'detail' : 'list'"
      @import="importing = true"
    />

    <McpDetail
      v-else-if="view === 'detail' && current"
      :state="state"
      :server="current"
      :scope="scope"
      :inherited="isInherited"
      @edit="view = 'edit'"
      @removed="back"
      @jump-global="jumpGlobal"
    />

    <McpList
      v-else
      :state="state"
      :scope="scope"
      :workspace="workspace"
      @update:scope="scope = $event"
      @open="open"
      @add="view = 'create'"
    />

    <McpImportDialog v-model:open="importing" :state="state" @imported="back" />
  </section>
</template>

<script setup lang="ts">
import { computed, inject, onUnmounted, ref, watch } from "vue"

import McpDetail from "@features/settings/components/mcp/McpDetail.vue"
import McpImportDialog from "@features/settings/components/mcp/McpImportDialog.vue"
import McpList from "@features/settings/components/mcp/McpList.vue"
import McpServerForm from "@features/settings/components/mcp/McpServerForm.vue"
import { useMcp } from "@features/settings/hooks/use-mcp.js"
import { SETTINGS_TRAIL, type SettingsCrumb } from "@features/settings/hooks/use-settings-dialog.js"
import { useI18n } from "@i18n/index.js"
import { notify } from "@pig/ui/toast"

defineProps<{ workspace: string | undefined }>()

const { t } = useI18n()
const trail = inject(SETTINGS_TRAIL)
const scope = ref("global")
const state = useMcp(scope)
const view = ref<"list" | "detail" | "create" | "edit">("list")
const selected = ref<string>()
const importing = ref(false)
const isInherited = computed(
  () => !!state.view.value?.inherited.some((server) => server.name === selected.value),
)
const current = computed(() =>
  [...(state.view.value?.servers ?? []), ...(state.view.value?.inherited ?? [])].find(
    (server) => server.name === selected.value,
  ),
)

function back() {
  view.value = "list"
  selected.value = undefined
}

function open(name: string) {
  selected.value = name
  view.value = "detail"
}

function onSaved(name: string) {
  notify(t("settings.mcp.saved"), "success")
  open(name)
}

async function jumpGlobal() {
  const name = selected.value

  scope.value = "global"
  await state.refresh()

  if (name) open(name)
}

const crumbs = computed<SettingsCrumb[]>(() => {
  if (view.value === "list") return [{ label: t("settings.mcp.title") }]
  const root = { label: t("settings.mcp.title"), action: back }

  if (view.value === "create") return [root, { label: t("settings.mcp.newServer") }]
  const name = current.value?.name ?? ""

  if (view.value === "edit")
    return [
      root,
      { label: name, action: () => (view.value = "detail") },
      { label: t("settings.mcp.edit") },
    ]
  return [root, { label: name }]
})

watch(
  crumbs,
  (value) => {
    if (trail) trail.value = value
  },
  { immediate: true },
)

watch(scope, () => {
  if (view.value !== "detail") back()
})

onUnmounted(() => {
  if (trail) trail.value = []
})
</script>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  padding-block-end: var(--space-md);
}
</style>
