<template>
  <div class="file-table">
    <TableRoot size="s" variant="ghost">
      <TableHeader>
        <TableRow>
          <TableCell v-for="(cell, index) in header" :key="index" kind="column-header">
            {{ cell }}
          </TableCell>
        </TableRow>
      </TableHeader>

      <TableBody>
        <TableRow v-for="(row, rowIndex) in body" :key="rowIndex">
          <TableCell v-for="(cell, index) in row" :key="index">{{ cell }}</TableCell>
        </TableRow>
      </TableBody>
    </TableRoot>

    <p v-if="hidden" class="file-table-more">{{ t("files.moreRows", { count: hidden }) }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import {
  TableBody,
  TableCell,
  TableHeader,
  TableRoot,
  TableRow,
} from "@components/ui/table/index.js"
import { parseDelimited } from "@features/file-pane/lib/csv.js"

/** 只画前这么多行；整份内容在源码视图里。 */
const ROW_LIMIT = 1_000
const props = defineProps<{ path: string; text: string }>()
const { t } = useI18n()
const rows = computed(() => parseDelimited(props.text, /\.tsv$/i.test(props.path) ? "\t" : ","))
const header = computed(() => rows.value[0] ?? [])
const body = computed(() => rows.value.slice(1, ROW_LIMIT + 1))
const hidden = computed(() => Math.max(0, rows.value.length - 1 - ROW_LIMIT))
</script>

<style scoped>
.file-table {
  flex: 1;
  min-block-size: 0;
  padding: 0 var(--space-md) var(--space-md);
  overflow: auto;
}

.file-table-more {
  margin: var(--space-sm) 0 0;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
}
</style>
