<template>
  <div v-bind="containerProps" class="groups">
    <div v-if="items.length" v-bind="wrapperProps">
      <ModelPickerRow
        v-for="row in list"
        :key="`${row.data.vendor.id}/${row.data.model.id}`"
        :vendor-id="row.data.vendor.id"
        :vendor-name="row.data.vendor.name"
        :model-name="row.data.model.name"
        :current="isCurrent(row.data.vendor.id, row.data.model.id)"
        :favorite="favorites.has(`${row.data.vendor.id}/${row.data.model.id}`)"
        :disabled="disabled"
        @select="emit('select', row.data.vendor.id, row.data.model.id)"
        @toggle-favorite="emit('toggleFavorite', row.data.vendor.id, row.data.model.id)"
      />
    </div>

    <div v-else-if="!catalog.length" class="empty empty-setup">
      {{ t("composer.noModelsConfigured") }}

      <Button type="button" size="s" variant="ghost" color="accent" @click="emit('configure')">
        {{ t("composer.configureModels") }}
      </Button>
    </div>

    <div v-else class="empty">{{ emptyText }}</div>
  </div>
</template>

<script setup lang="ts">
import { useVirtualList } from "@vueuse/core"
import { computed, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { Button } from "@pig/ui/button"
import ModelPickerRow from "@features/composer/components/ModelPickerRow.vue"
import type { ModelPickerRow as PickerRow } from "@features/composer/lib/model-preset.js"
import type { ComposerModel, ComposerVendor } from "@features/composer/type.js"
import { sameModel } from "@features/session/lib/model-ref.js"

const ROW_HEIGHT = 28
const props = withDefaults(
  defineProps<{
    items: PickerRow[]
    catalog: ComposerVendor[]
    favorites: ReadonlySet<string>
    model?: ComposerModel | undefined
    emptyText?: string
    disabled?: boolean
  }>(),
  { model: undefined, emptyText: "", disabled: false },
)
const emit = defineEmits<{
  select: [provider: string, id: string]
  toggleFavorite: [provider: string, id: string]
  configure: []
}>()
const { t } = useI18n()
const { list, containerProps, wrapperProps, scrollTo } = useVirtualList(
  computed(() => props.items),
  { itemHeight: ROW_HEIGHT },
)

watch(
  () => props.items,
  () => scrollTo(0),
)

function isCurrent(provider: string, id: string): boolean {
  return props.model !== undefined && sameModel(props.model, { provider, id })
}
</script>

<style scoped>
.groups {
  flex: 0 1 auto;
  min-height: 80px;
  max-height: min(200px, 40vh);
  padding: var(--space-2xs);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}

.empty {
  padding: var(--space-md) var(--space-xs);
  font-size: var(--text-meta);
  color: var(--fg-secondary);
  text-align: center;
}

.empty-setup {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
}
</style>
