<template>
  <section class="pane">
    <CustomProviderForm v-if="creating" @cancel="creating = false" @saved="onCreated" />

    <CustomProviderForm
      v-else-if="selected && selected.kind === 'custom' && editing === selected.id"
      :key="selected.id"
      :provider="selected"
      @cancel="editing = undefined"
      @saved="onSaved"
      @deleted="onDeleted"
    />

    <ProviderDetail
      v-else-if="selected"
      :provider="selected"
      :editable="selected.kind === 'custom'"
      :refresh-models="reloadModels"
      @back="select(undefined)"
      @changed="onChanged"
      @edit="editing = selected.id"
    />

    <ProviderList
      v-else
      :providers="providers"
      :loading="loading"
      :error="error"
      @select="select"
      @retry="refresh"
      @add="creating = true"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, inject, onUnmounted, ref, watch } from "vue"

import CustomProviderForm from "@features/settings/components/models/CustomProviderForm.vue"
import ProviderDetail from "@features/settings/components/models/ProviderDetail.vue"
import ProviderList from "@features/settings/components/models/ProviderList.vue"
import { useProviders } from "@features/settings/hooks/use-providers.js"
import { SETTINGS_TRAIL, type SettingsCrumb } from "@features/settings/hooks/use-settings-dialog.js"
import { useI18n } from "@i18n/index.js"

const props = defineProps<{ refreshModels?: (() => Promise<void>) | undefined }>()
const { providers, loading, error, selected, select, refresh, refreshCatalog } = useProviders()
const { t } = useI18n()
const trail = inject(SETTINGS_TRAIL)
const creating = ref(false)
const editing = ref<string>()
/** 头部面包屑：列表、详情、新建与编辑共用一条路径。 */
const crumbs = computed<SettingsCrumb[]>(() => {
  const backToList = () => {
    creating.value = false
    editing.value = undefined
    select(undefined)
  }
  const items: SettingsCrumb[] = [{ label: t("settings.models.title") }]

  if (!selected.value && !creating.value) {
    items.push({ label: t("settings.models.providers") })
    return items
  }

  items[0] = { label: t("settings.models.title"), action: backToList }
  items.push({ label: t("settings.models.providers"), action: backToList })

  if (creating.value) items.push({ label: t("settings.models.newProvider") })
  else if (selected.value) {
    const provider = selected.value
    const editingProvider = editing.value === provider.id

    items.push({
      label: provider.name,
      ...(editingProvider ? { action: () => (editing.value = undefined) } : {}),
    })

    if (editingProvider) items.push({ label: t("settings.models.editProvider") })
  }

  return items
})

watch(
  crumbs,
  (value) => {
    if (trail) trail.value = value
  },
  { immediate: true },
)

onUnmounted(() => {
  if (trail) trail.value = []
})

/** 先让 gateway 刷新 runtime 并换掉列表，再让 Composer 目录跟上。 */
async function reloadModels() {
  await refreshCatalog()
  await props.refreshModels?.()
}

/** 连接、参数或开放状态变化后，供应商列表与 Composer 目录一起刷新。 */
async function onChanged() {
  await refresh()
  await props.refreshModels?.()
}

async function onCreated(id: string) {
  creating.value = false
  await refresh()
  select(id)
}

/** 保存自定义供应商后留在详情页。 */
async function onSaved() {
  editing.value = undefined
  await refresh()
}

async function onDeleted() {
  select(undefined)
  await refresh()
}
</script>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  padding-block-end: var(--space-md);
}
</style>
