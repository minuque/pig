<template>
  <section class="provider-list">
    <div class="list-tools">
      <label class="provider-search">
        <SearchIcon class="search-icon" />

        <input
          v-model="query"
          type="text"
          :placeholder="t('settings.models.searchProviders')"
          :aria-label="t('settings.models.searchProviders')"
        />
      </label>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            class="add-provider"
            size="s"
            variant="surface"
            :aria-label="t('settings.models.addProvider')"
            @click="emit('add')"
          >
            <PlusIcon />
          </Button>
        </TooltipTrigger>

        <TooltipContent>{{ t("settings.models.addProvider") }}</TooltipContent>
      </Tooltip>
    </div>

    <p v-if="loading && !providers.length" class="list-state">{{ t("settings.models.loading") }}</p>

    <div v-else-if="error" class="list-state">
      <span>{{ error }}</span>

      <button type="button" class="retry" @click="emit('retry')">
        {{ t("settings.models.retry") }}
      </button>
    </div>

    <div v-for="group in groups" :key="group.id" class="provider-group">
      <h3 class="provider-group-title">{{ t(`settings.models.group.${group.id}`) }}</h3>

      <Card size="l" class="provider-card">
        <button
          v-for="provider in group.providers"
          :key="provider.id"
          type="button"
          class="provider-row"
          :data-provider="provider.id"
          @click="emit('select', provider.id)"
        >
          <span class="provider-mark">
            <VendorMark :vendor="provider.id" :name="provider.name" :size="20" />
          </span>

          <span class="provider-main">
            <span class="provider-name">
              {{ provider.name }}
              <span v-if="sourceKind(provider) !== 'none'" class="provider-badge-soft">
                {{ t(`settings.models.source.${sourceKind(provider)}`) }}
              </span>
            </span>

            <span class="provider-id">{{ provider.id }}</span>
          </span>

          <span v-if="provider.status.configured" class="provider-count">
            {{ t("settings.models.modelCount", { count: provider.models.length }) }}
          </span>

          <ChevronRightIcon class="provider-chevron" />
        </button>
      </Card>
    </div>

    <p v-if="!loading && !groups.length" class="list-state">
      {{ t("settings.models.noMatch") }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"

import { useI18n } from "@i18n/index.js"
import { PlusIcon, ChevronRightIcon, SearchIcon } from "@components/icons/index.js"
import { Button } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import VendorMark from "@features/composer/components/VendorMark.vue"
import { groupProviders, providerSourceText } from "@features/settings/lib/provider-view.js"
import type { ProviderView } from "@/types/common-type.js"
import { Card } from "@components/ui/card/index.js"

const props = defineProps<{
  providers: ProviderView[]
  loading: boolean
  error?: string | undefined
}>()
const emit = defineEmits<{ select: [id: string]; retry: []; add: [] }>()
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
  flex-direction: column;
}

.list-tools {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-block-end: var(--space-md);
}

.add-provider {
  flex: none;
  inline-size: 24px;
  block-size: 24px;
  padding: 0;
}

.provider-search {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: var(--space-xs);
  height: 34px;
  padding-inline: var(--space-sm);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-control);
  background: var(--bg-surface);
  color: var(--fg-faint);
}

.search-icon {
  flex: none;
}

.provider-search input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--fg);
  font-size: var(--text-meta);
}

.provider-search input::placeholder {
  color: var(--fg-faint);
}

.provider-card {
  /* 内容让出外环一个线宽：行线与悬停底不叠到半透明外环上加深 */
  padding: var(--border-width);
}

.provider-group + .provider-group {
  margin-block-start: var(--space-lg);
}

.provider-group-title {
  margin: 0 0 var(--space-xs);
  padding-inline: var(--space-lg);
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
  padding-inline: var(--card-padding);
  color: var(--fg);
  text-align: start;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.provider-row + .provider-row {
  box-shadow: var(--separator-top);
}

.provider-row:hover {
  background: var(--bg-hover);
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

.provider-badge-soft {
  display: inline-flex;
  align-items: center;
  height: 16px;
  padding-inline: 5px;
  border: var(--border-width) solid var(--border-subtle);
  border-radius: var(--radius-control);
  background: var(--bg-muted);
  color: var(--fg-faint);
  font-size: 9px;
  font-weight: var(--font-weight-medium);
}

.provider-id {
  color: var(--fg-faint);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.provider-count {
  flex: none;
  color: var(--fg-faint);
  font-size: var(--text-meta);
  white-space: nowrap;
}

.provider-chevron {
  flex: none;
  color: var(--fg-faint);
}

.list-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  margin: 0;
  padding-block: var(--space-xl);
  color: var(--fg-faint);
  font-size: var(--text-meta);
}

.retry {
  color: var(--link);
  font-size: var(--text-meta);
}

@media (prefers-reduced-motion: reduce) {
  .provider-row {
    transition: none;
  }
}

:deep(.rt-BaseButton.rt-r-size-1) {
  font-size: var(--text-body);
}
</style>
