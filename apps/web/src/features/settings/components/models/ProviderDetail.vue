<template>
  <section class="provider-detail">
    <button type="button" class="provider-back" @click="emit('back')">
      <ArrowLeftIcon class="back-icon" />
      {{ t("settings.models.providers") }}
    </button>

    <header class="detail-head">
      <span class="detail-mark">
        <VendorMark :vendor="provider.id" :name="provider.name" :size="26" />
      </span>

      <div class="detail-copy">
        <h2 class="provider-detail-title">{{ provider.name }}</h2>

        <div class="detail-sub">
          <span class="detail-id">{{ provider.id }}</span>

          <span class="provider-badge" :data-state="badge">
            {{ t(`settings.models.status.${badge}`) }}
          </span>
        </div>
      </div>
    </header>

    <section class="detail-sec">
      <h3 class="sec-title">{{ t("settings.models.connection") }}</h3>

      <div class="kvgroup">
        <div class="kvrow">
          <span class="kvlabel">{{ t("settings.models.authMethod") }}</span>
          <span class="kvvalue">{{ authLabel }}</span>
        </div>

        <div class="kvrow">
          <span class="kvlabel">{{ t("settings.models.sourceLabel") }}</span>

          <span class="kvvalue" :class="{ muted: sourceKind === 'none' }">
            {{ t(`settings.models.source.${sourceKind}`) }}
          </span>
        </div>

        <div v-if="provider.status.configured" class="kvrow">
          <span class="kvlabel">{{ t("settings.models.availableModels") }}</span>

          <span class="kvvalue">
            {{ t("settings.models.modelCount", { count: provider.models.length }) }}
          </span>
        </div>
      </div>

      <p class="note">{{ t("settings.models.authNote") }}</p>
    </section>

    <section v-if="provider.status.configured" class="detail-sec">
      <h3 class="sec-title">
        {{ t("settings.models.modelList") }}
        <span class="sec-count">
          {{ t("settings.models.modelCount", { count: provider.models.length }) }}
        </span>
      </h3>

      <p v-if="!provider.models.length" class="empty">{{ t("settings.models.noModels") }}</p>

      <div v-for="model in provider.models" :key="model.id" class="provider-model-row">
        <span class="model-name">{{ model.name }}</span>
        <span class="model-meta">{{ modelMeta(model) }}</span>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue"

import { useI18n } from "@i18n/index.js"
import { ArrowLeftIcon } from "@components/icons/index.js"
import VendorMark from "@features/composer/components/VendorMark.vue"
import {
  modelMeta,
  providerSourceText,
  providerStatusBadge,
} from "@features/settings/lib/provider-view.js"
import type { ProviderView } from "@/types/provider-type.js"

const props = withDefaults(
  defineProps<{
    provider: ProviderView
    authorizing?: boolean
  }>(),
  { authorizing: false },
)
const emit = defineEmits<{ back: [] }>()
const { t } = useI18n()
const badge = computed(() => providerStatusBadge(props.provider, props.authorizing))
const sourceKind = computed(() => providerSourceText(props.provider.status))
const authLabel = computed(() => {
  const { apiKey, oauth } = props.provider.capabilities

  if (oauth && !apiKey) return t("settings.models.oauth")

  if (apiKey) return t("settings.models.apiKey")
  return t("settings.models.ambient")
})
</script>

<style scoped>
.provider-detail {
  display: flex;
  flex-direction: column;
}

.provider-back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  align-self: flex-start;
  height: 26px;
  margin-block-end: var(--space-md);
  color: var(--contrast-foreground-muted);
  font-size: var(--text-caption);
}

.back-icon {
  inline-size: 12px;
  block-size: 12px;
}

.detail-head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding-block-end: var(--space-md);
}

.detail-mark {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
}

.detail-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.provider-detail-title {
  margin: 0;
  color: var(--contrast-foreground);
  font-size: var(--text-body-lg);
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}

.detail-sub {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--contrast-foreground-muted);
  font-size: var(--text-caption);
}

.provider-badge {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding-inline: 6px;
  border: var(--border-width) solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: var(--hover-quiet);
  color: var(--contrast-foreground-muted);
  font-size: var(--text-eyebrow);
}

.provider-badge[data-state="connected"] {
  border-color: var(--success-halo);
  background: var(--success-bg);
  color: var(--success);
}

.provider-badge[data-state="authorizing"] {
  background: var(--hover-quiet);
  color: var(--warning);
}

.detail-sec {
  padding-block-start: var(--space-md);
}

.sec-title {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  margin: 0 0 var(--space-sm);
  color: var(--contrast-foreground-muted);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-semibold);
  line-height: var(--text-body-sm--line-height);
}

.sec-count {
  color: var(--contrast-foreground-faint);
  font-weight: var(--font-weight-normal);
}

.kvgroup {
  padding: 2px var(--space-sm);
  border: var(--border-width) solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--card);
}

.kvrow {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-height: 38px;
}

.kvlabel {
  flex: none;
  width: 72px;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-caption);
}

.kvvalue {
  color: var(--contrast-foreground);
  font-size: var(--text-caption);
}

.kvvalue.muted {
  color: var(--contrast-foreground-faint);
}

.note {
  margin: var(--space-sm) 0 0;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
  line-height: 1.4;
}

.empty {
  margin: 0;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-caption);
}

.provider-model-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  height: 40px;
  padding-inline: var(--space-sm);
  border-radius: var(--radius-md);
}

.model-name {
  color: var(--contrast-foreground);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
}

.model-meta {
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
}
</style>
