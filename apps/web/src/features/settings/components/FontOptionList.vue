<template>
  <div v-bind="containerProps" class="font-scroller">
    <div v-bind="wrapperProps" class="font-rows">
      <SelectItem
        v-for="row in list"
        :key="row.data.value"
        :value="row.data.value"
        :index="row.index"
        :style="row.data.family ? { fontFamily: JSON.stringify(row.data.family) } : undefined"
      >
        <SelectItemText>{{ row.data.label }}</SelectItemText>
      </SelectItem>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVirtualList } from "@vueuse/core"
import { computed, watch } from "vue"
import { SelectItem, SelectItemText } from "@pig/ui/select"
import type { FontOption } from "@features/settings/lib/font-options.js"

const ROW_HEIGHT = 30
const props = defineProps<{ items: readonly FontOption[] }>()
const source = computed(() => props.items)
const { list, containerProps, wrapperProps, scrollTo } = useVirtualList(source, {
  itemHeight: ROW_HEIGHT,
})

watch(source, () => scrollTo(0))

function revealRow(index: number): void {
  const el = containerProps.ref.value

  if (!el || index < 0) return
  const top = index * ROW_HEIGHT
  const bottom = top + ROW_HEIGHT

  if (top < el.scrollTop) el.scrollTop = top
  else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight
}

defineExpose({ revealRow })
</script>

<style scoped>
.font-scroller {
  flex: 1 1 auto;
  min-block-size: 0;
  padding: var(--space-2xs);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.font-rows {
  display: grid;
  align-content: start;
  gap: var(--menu-item-gap);
}
</style>
