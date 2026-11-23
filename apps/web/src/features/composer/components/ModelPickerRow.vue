<template>
  <div class="model-row" :data-current="current ? '' : undefined">
    <button
      type="button"
      class="model-item"
      data-menu-item
      :data-disabled="disabled ? '' : undefined"
      :disabled="disabled"
      @click="emit('select')"
    >
      <VendorMark :vendor="vendorId" :name="vendorName" :size="14" />
      <span class="model-name">{{ vendorId }}/{{ modelName }}</span>
    </button>

    <button
      type="button"
      class="fav"
      :aria-label="
        favorite
          ? t('composer.unfavorite', { name: modelName })
          : t('composer.favorite', { name: modelName })
      "
      :aria-pressed="favorite"
      :class="{ on: favorite }"
      @click="emit('toggleFavorite')"
    >
      <StarFilledIcon v-if="favorite" />
      <StarIcon v-else />
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"
import VendorMark from "@components/icons/VendorMark.vue"
import { StarFilledIcon, StarIcon } from "@components/icons/index.js"

withDefaults(
  defineProps<{
    vendorId: string
    vendorName: string
    modelName: string
    current: boolean
    favorite: boolean
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  select: []
  toggleFavorite: []
}>()
const { t } = useI18n()
</script>

<style scoped>
.model-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--control-sm);
  align-items: center;
  height: var(--control-sm);
  padding-inline-end: var(--space-2xs);
  border-radius: var(--radius-control);
  transition: background-color var(--duration-fast) var(--ease-out);
}

.model-row:hover,
.model-row:focus-within {
  background: var(--bg-hover);
}

.model-row[data-current] {
  background: var(--bg-selected);
}

.model-item {
  flex: 1 1 auto;
  min-inline-size: 0;
  gap: var(--space-xs);
  block-size: var(--control-sm);
  padding-inline: 6px;
  padding-block: 0;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--fg);
  font-family: inherit;
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  text-align: start;
  cursor: pointer;
}

.model-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fav {
  display: grid;
  place-items: center;
  inline-size: var(--control-sm);
  block-size: var(--control-sm);
  padding: 0;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-out);
}

.fav:hover {
  background: var(--bg-hover);
  color: var(--fg);
}

.fav.on,
.fav.on:hover {
  color: var(--favorite);
}

.fav:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: -2px;
}
</style>
