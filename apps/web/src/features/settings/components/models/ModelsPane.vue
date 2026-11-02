<template>
  <section class="pane">
    <CustomProviderForm v-if="creating" @cancel="creating = false" @saved="onCreated" />

    <CustomProviderForm
      v-else-if="selected && selected.kind === 'custom'"
      :key="selected.id"
      :provider="selected"
      @cancel="select(undefined)"
      @saved="refresh"
      @deleted="onDeleted"
    />

    <ProviderDetail
      v-else-if="selected"
      :provider="selected"
      :refresh-models="reloadModels"
      @back="select(undefined)"
      @changed="refresh"
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
import { ref } from "vue"

import CustomProviderForm from "@features/settings/components/models/CustomProviderForm.vue"
import ProviderDetail from "@features/settings/components/models/ProviderDetail.vue"
import ProviderList from "@features/settings/components/models/ProviderList.vue"
import { useProviders } from "@features/settings/hooks/use-providers.js"

const props = defineProps<{ refreshModels?: (() => Promise<void>) | undefined }>()
const { providers, loading, error, selected, select, refresh, refreshCatalog } = useProviders()
const creating = ref(false)

/** 先让 gateway 刷新 runtime 并换掉列表，再让 Composer 目录跟上。 */
async function reloadModels() {
  await refreshCatalog()
  await props.refreshModels?.()
}

async function onCreated(id: string) {
  creating.value = false
  await refresh()
  select(id)
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
