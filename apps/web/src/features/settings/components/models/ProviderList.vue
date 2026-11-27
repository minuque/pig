<template>
  <section class="provider-list">
    <Card size="m" class="list-tools">
      <TextFieldRoot
        v-model="query"
        class="provider-search"
        size="m"
        :placeholder="t('settings.models.searchProviders')"
        :aria-label="t('settings.models.searchProviders')"
      >
        <TextFieldSlot side="left">
          <SearchIcon class="size-icon" />
        </TextFieldSlot>
      </TextFieldRoot>

      <Button type="button" size="m" variant="outline" @click="emit('add')">
        <PlusIcon class="size-icon" />
        {{ t("settings.models.addProvider") }}
      </Button>
    </Card>

    <p v-if="loading && !providers.length" class="list-state">{{ t("settings.models.loading") }}</p>

    <EmptyState
      v-else-if="error && !providers.length"
      :title="t('settings.models.loadFailedTitle')"
      :description="t('settings.models.loadFailedBody')"
    >
      <template #art><HairlineArt figure="plug" /></template>
      <template #actions><RetryButton :action="onRetry" /></template>
    </EmptyState>

    <div v-else-if="error" class="list-state">
      <span>{{ error }}</span>
      <RetryButton size="s" variant="ghost" :action="onRetry" />
    </div>

    <div v-for="group in groups" :key="group.id" class="provider-group">
      <h3 class="provider-group-title">{{ t(`settings.models.group.${group.id}`) }}</h3>

      <CardList>
        <CardRow
          v-for="provider in group.providers"
          :key="provider.id"
          interactive
          type="button"
          class="provider-row"
          :data-provider="provider.id"
          @click="emit('select', provider.id)"
        >
          <template #render="{ props: part }">
            <button v-bind="part">
              <span class="provider-mark">
                <VendorMark :vendor="provider.id" :name="provider.name" :size="20" />
              </span>

              <span class="provider-main">
                <span class="provider-name">
                  {{ provider.name }}

                  <Badge
                    v-if="sourceKind(provider) !== 'none'"
                    size="s"
                    variant="soft"
                    color="neutral"
                  >
                    {{ t(`settings.models.source.${sourceKind(provider)}`) }}
                  </Badge>
                </span>

                <span class="provider-id">{{ provider.id }}</span>
              </span>

              <span v-if="provider.status.configured" class="provider-count">
                {{ t("settings.models.modelCount", { count: provider.models.length }) }}
              </span>

              <ChevronRightIcon class="provider-chevron" />
            </button>
          </template>
        </CardRow>
      </CardList>
    </div>

    <EmptyState
      v-if="providers.length && !groups.length && query.trim()"
      live
      :title="t('settings.models.noMatch', { query: query.trim() })"
      :description="t('settings.models.noMatchBody')"
    >
      <template #art><HairlineArt figure="query" /></template>

      <template #actions>
        <Button type="button" variant="secondary" color="neutral" @click="query = ''">
          {{ t("common.clearSearch") }}
        </Button>
      </template>
    </EmptyState>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"

import { useI18n } from "@i18n/index.js"
import { PlusIcon, ChevronRightIcon, SearchIcon } from "@components/icons/index.js"
import { Button } from "@pig/ui/button"
import { Badge } from "@pig/ui/badge"
import { TextFieldRoot, TextFieldSlot } from "@pig/ui/text-field"
import VendorMark from "@components/icons/VendorMark.vue"
import { groupProviders, providerSourceText } from "@features/settings/lib/provider-view.js"
import type { ProviderView } from "@/types/common-type.js"
import { Card, CardList, CardRow } from "@pig/ui/card"
import { EmptyState } from "@pig/ui/empty-state"
import HairlineArt from "@components/empty/HairlineArt.vue"
import RetryButton from "@components/empty/RetryButton.vue"

const props = defineProps<{
  providers: ProviderView[]
  loading: boolean
  error?: string | undefined
  onRetry: () => unknown
}>()
const emit = defineEmits<{ select: [id: string]; add: [] }>()
const { t } = useI18n()
const query = ref("")
const groups = computed(() => groupProviders(props.providers, query.value))

function sourceKind(provider: ProviderView) {
  return providerSourceText(provider.status)
}
</script>

<style scoped>
.provider-list {
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
}

.list-tools {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-block-end: var(--space-md);
}

.provider-search {
  min-width: 0;
  flex: 1;
}

.provider-group + .provider-group {
  margin-block-start: var(--space-lg);
}

.provider-group-title {
  margin: 0 0 var(--space-xs);
  padding-inline: var(--space-md);
  color: var(--fg);
  font-size: var(--text-title);
  font-weight: var(--font-weight-semibold);
  line-height: var(--text-title--line-height);
}

.provider-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  height: 60px;
  color: var(--fg);
  text-align: start;
}

.provider-mark {
  display: grid;
  place-items: center;
  flex: none;
  width: 28px;
  height: 28px;
}

.provider-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.provider-name {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body--line-height);
}

.provider-id {
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.provider-count {
  flex: none;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  white-space: nowrap;
}

.provider-chevron {
  flex: none;
  color: var(--fg-secondary);
}

.list-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  margin: 0;
  padding-block: var(--space-xl);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

@media (prefers-reduced-motion: reduce) {
  .provider-row {
    transition: none;
  }
}
</style>
