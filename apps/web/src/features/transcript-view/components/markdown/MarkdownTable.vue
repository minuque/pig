<template>
  <div ref="root" class="md-table">
    <TableRoot variant="surface" size="s" class="md-table-root"><slot /></TableRoot>

    <Tooltip>
      <TooltipTrigger as-child>
        <IconButton
          type="button"
          size="s"
          variant="ghost"
          color="gray"
          class="md-table-zoom"
          :aria-label="previewLabel"
          @click.stop="openPreview"
        >
          <MaximizeSquareIcon class="size-icon" />
        </IconButton>
      </TooltipTrigger>

      <TooltipContent>{{ previewLabel }}</TooltipContent>
    </Tooltip>

    <PreviewDialog
      v-model:open="previewOpen"
      class="md-table-dialog"
      :title="previewTitle"
      :meta="previewMeta"
    >
      <TableRoot variant="surface" size="m" class="md-table-root is-preview"><slot /></TableRoot>
    </PreviewDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@components/ui/button/index.js"
import { TableRoot } from "@components/ui/table/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { MaximizeSquareIcon } from "@components/icons/index.js"
import PreviewDialog from "@features/preview/index.vue"
import { headingBefore } from "@features/transcript-view/lib/nearest-heading.js"

const { t } = useI18n()
const previewOpen = ref(false)
const previewLabel = computed(() => t("transcript.tablePreview"))
const root = useTemplateRef("root")
const previewTitle = ref("")
const previewMeta = ref("")

/** 标题取表格上方最近的标题，副标题是正文里这张表的行列数。 */
function openPreview() {
  const table = root.value?.querySelector("table")
  previewTitle.value = headingBefore(root.value) ?? t("transcript.table")
  previewMeta.value = table
    ? t("transcript.tableSize", {
        rows: table.tBodies[0]?.rows.length ?? 0,
        cols: table.rows[0]?.cells.length ?? 0,
      })
    : ""
  previewOpen.value = true
}
</script>

<style scoped>
.md-table {
  position: relative;
  min-width: 0;
}

/* 外观来自 surface 表格的统一卡片样式；字号随正文 */
.md-table-root :deep(.rt-TableRootTable) {
  font-size: inherit;
  line-height: inherit;
}

/* 正文里单元格限宽并按词折行，长内容去弹框里看全 */
.md-table-root :deep(.rt-TableCell) {
  max-width: 24em;
  overflow-wrap: break-word;
}

.md-table-root.is-preview :deep(.rt-TableCell) {
  max-width: none;
}

/* 放大按钮压在表头右上角，表头末格给它让位 */
.md-table-zoom {
  position: absolute;
  top: var(--space-xxs);
  inset-inline-end: var(--space-xxs);
}

.md-table-root:not(.is-preview) :deep(.rt-TableColumnHeaderCell:last-child) {
  padding-inline-end: var(--size-icon-button);
}
</style>

<style>
/* 面板经 Portal 挂到 body，scoped 打不中。宽度与设置弹窗同档；
   高度跟表格内容走，最高到设置弹窗的高度，再高就在正文里滚动 */
.md-table-dialog.rt-DialogContent {
  width: min(88vw, var(--size-settings-dialog-width));
  max-width: min(88vw, var(--size-settings-dialog-width));
  height: auto;
  max-height: min(85vh, var(--size-settings-dialog-height));
}
</style>
