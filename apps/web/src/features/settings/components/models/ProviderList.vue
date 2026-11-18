<template>
  <section class="provider-list">
    <div class="list-tools">
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

      <Tooltip>
        <TooltipTrigger as-child>
          <IconButton
            type="button"
            size="m"
            variant="surface"
            :aria-label="t('settings.models.addProvider')"
            @click="emit('add')"
          >
            <PlusIcon class="size-icon" />
          </IconButton>
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

      <CardList>
        <CardRow
          v-for="provider in group.providers"
          :key="provider.id"
          as="button"
          interactive
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
        </CardRow>
      </CardList>
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
import { IconButton } from "@components/ui/button/index.js"
import { TextFieldRoot, TextFieldSlot } from "@components/ui/text-field/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import VendorMark from "@features/composer/components/VendorMark.vue"
import { groupProviders, providerSourceText } from "@features/settings/lib/provider-view.js"
import type { ProviderView } from "@/types/common-type.js"
import { CardList, CardRow } from "@components/ui/card/index.js"

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
</style>
