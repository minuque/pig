<template>
  <div class="model-row" :data-current="current ? '' : undefined">
    <DropdownMenuItem class="model-item" @select="emit('select', $event)">
      <VendorMark :vendor="vendorId" :name="vendorName" :size="14" />
      <span class="model-name">{{ vendorId }}/{{ modelName }}</span>
    </DropdownMenuItem>

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
      @pointerdown.stop
      @click.stop="emit('toggleFavorite')"
    >
      <StarBoldIcon v-if="favorite" :size="14" />
      <StarIcon v-else :size="14" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"
import { DropdownMenuItem } from "@components/ui/dropdown-menu/index.js"
import VendorMark from "@features/composer/components/VendorMark.vue"
import { StarBoldIcon, StarIcon } from "@components/icons/index.js"

defineProps<{
  vendorId: string
  vendorName: string
  modelName: string
  current: boolean
  favorite: boolean
}>()

const emit = defineEmits<{
  select: [event: Event]
  toggleFavorite: []
}>()
const { t } = useI18n()
</script>

<style scoped>
/* 行高 28px：悬停与键盘高亮同一底色，当前模型再深一档 */
.model-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20px;
  align-items: center;
  gap: var(--space-xxs);
  height: 28px;
  padding-inline-end: var(--space-xxs);
  border-radius: var(--radius-control);
  transition: background-color var(--duration-fast) var(--ease-hover);
}

.model-row:hover,
.model-row:focus-within {
  background: var(--hover-quiet);
}

.model-row[data-current] {
  background: var(--hover-tint);
}

.model-item {
  flex: 1 1 auto;
  min-inline-size: 0;
  gap: var(--space-xs);
  block-size: 28px;
  padding-inline: 6px;
  padding-block: 0;
  border-radius: var(--radius-control);
  color: var(--contrast-foreground);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  cursor: pointer;
}

.model-item:hover,
.model-item:focus,
.model-item[data-highlighted] {
  background: transparent;
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
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--contrast-foreground-faint);
  opacity: 0.6;
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease-hover),
    opacity var(--duration-fast) var(--ease-hover);
}

.fav:hover {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
  opacity: 1;
}

.fav.on,
.fav.on:hover {
  color: var(--favorite);
  opacity: 1;
}

.fav:focus-visible {
  outline: var(--border-width) solid var(--primary);
  outline-offset: -2px;
}
</style>
