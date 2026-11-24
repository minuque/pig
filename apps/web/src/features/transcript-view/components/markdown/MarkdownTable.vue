<template>
  <div ref="root" class="md-table">
    <TableRoot variant="surface" size="s" class="md-table-root"><slot /></TableRoot>

    <Tooltip>
      <TooltipTrigger>
        <template #render="{ props: part }">
          <IconButton
            v-bind="part"
            type="button"
            size="s"
            variant="ghost"
            color="neutral"
            class="md-table-zoom"
            :aria-label="previewLabel"
            @click.stop="openPreview"
          >
            <Maximize2Icon class="size-icon" />
          </IconButton>
        </template>
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
import { IconButton } from "@pig/ui/button"
import { TableRoot } from "@pig/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import { Maximize2Icon } from "@components/icons/index.js"
import PreviewDialog from "@features/preview/index.vue"
import { headingBefore } from "@features/transcript-view/lib/nearest-heading.js"

const { t } = useI18n()
const previewOpen = ref(false)
const previewLabel = computed(() => t("transcript.tablePreview"))
const root = useTemplateRef("root")
const previewTitle = ref("")
const previewMeta = ref("")

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

.md-table-root :deep([data-slot="table-element"]) {
  font-size: inherit;
  line-height: inherit;
}

.md-table-root :deep([data-slot="table-cell"]) {
  max-width: 24em;
  overflow-wrap: break-word;
}

.md-table-root.is-preview :deep([data-slot="table-cell"]) {
  max-width: none;
}

.md-table-zoom {
  position: absolute;
  z-index: var(--z-raise);
  top: var(--space-2xs);
  inset-inline-end: var(--space-2xs);
  color: var(--fg-secondary);
}

.md-table-zoom:hover {
  color: var(--fg);
}

.md-table-root:not(.is-preview)
  :deep([data-slot="table-cell"][data-kind="column-header"]:last-child) {
  padding-inline-end: var(--control-sm);
}
</style>

<style>
.md-table-dialog[data-slot="dialog-content"] {
  width: min(88vw, var(--dialog-width-lg));
  max-width: min(88vw, var(--dialog-width-lg));
  height: auto;
  max-height: min(85vh, var(--dialog-height-lg));
}
</style>
