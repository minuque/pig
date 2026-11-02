<template>
  <section class="pane">
    <ProviderDetail
      v-if="selected"
      :provider="selected"
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
    />
  </section>
</template>

<script setup lang="ts">
import ProviderDetail from "@features/settings/components/models/ProviderDetail.vue"
import ProviderList from "@features/settings/components/models/ProviderList.vue"
import { useProviders } from "@features/settings/hooks/use-providers.js"

const { providers, loading, error, selected, select, refresh } = useProviders()
</script>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  padding-block-end: var(--space-md);
}
</style>
