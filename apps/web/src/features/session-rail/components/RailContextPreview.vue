<template>
  <PreviewDialog v-model:open="open" class="ctx-preview-dialog" :title="title">
    <template #actions>
      <Tooltip v-if="!loading && !failed">
        <TooltipTrigger>
          <template #render="{ props: part }">
            <IconButton
              v-bind="part"
              type="button"
              size="s"
              variant="ghost"
              color="neutral"
              :aria-label="toggleLabel"
              @click="source = !source"
            >
              <SquareCodeIcon v-if="!source" class="size-icon" />
              <EyeIcon v-else class="size-icon" />
            </IconButton>
          </template>
        </TooltipTrigger>

        <TooltipContent>{{ toggleLabel }}</TooltipContent>
      </Tooltip>
    </template>

    <div v-if="loading" class="ctx-preview-status"><Spinner size="m" /></div>
    <EmptyState v-else-if="failed" :title="t('rail.previewFailed')">
      <template #art><CircleExclamationPointIcon class="ctx-preview-art" /></template>
      <template #actions><RetryButton :action="() => load(true)" /></template>
    </EmptyState>

    <FileCode v-else-if="source" path="context.md" :text="body" />
    <MarkdownContent v-else :nodes="nodes" />
  </PreviewDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { contextPreview } from "@client/platform.js"
import { IconButton } from "@pig/ui/button"
import { EmptyState } from "@pig/ui/empty-state"
import { Spinner } from "@pig/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import { CircleExclamationPointIcon, EyeIcon, SquareCodeIcon } from "@components/icons/index.js"
import RetryButton from "@components/empty/RetryButton.vue"
import FileCode from "@features/file-pane/components/FileCode.vue"
import PreviewDialog from "@features/preview/index.vue"
import MarkdownContent from "@features/transcript-view/components/markdown/MarkdownContent.vue"
import { useMarkdownNodes } from "@features/transcript-view/hooks/use-markdown-nodes.js"
import type { ContextUsageSegment } from "@features/composer/type.js"

const props = defineProps<{ sessionId: string; segment: ContextUsageSegment }>()
const open = defineModel<boolean>("open", { default: false })
const { t } = useI18n()
const loading = ref(false)
const failed = ref(false)
const body = ref("")
const loadedTitle = ref("")
const source = ref(false)
const title = computed(() => loadedTitle.value || props.segment.label)
const toggleLabel = computed(() => (source.value ? t("files.preview") : t("files.viewSource")))
const nodes = useMarkdownNodes({
  text: () => body.value,
  streaming: () => false,
  cacheKey: () => `context:${props.sessionId}/${props.segment.id}`,
})

let loadSeq = 0

async function load(quiet = false) {
  const seq = ++loadSeq

  if (!quiet) {
    loading.value = true
    failed.value = false
    body.value = ""
    loadedTitle.value = ""
  }

  try {
    const preview = await contextPreview(props.sessionId, props.segment.id)

    if (seq !== loadSeq) return
    loadedTitle.value = preview?.title ?? ""
    body.value = preview?.content || t("rail.previewEmpty")
    failed.value = false
  } catch {
    if (seq === loadSeq) failed.value = true
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

watch(
  () => [props.sessionId, props.segment.id] as const,
  () => void load(),
  { immediate: true },
)
</script>

<style scoped>
.ctx-preview-art {
  inline-size: var(--icon-xl);
  block-size: var(--icon-xl);
}

.ctx-preview-status {
  display: grid;
  flex: 1;
  place-items: center;
}
</style>

<style>
.ctx-preview-dialog[data-slot="dialog-content"] {
  width: min(88vw, var(--dialog-width-lg));
  max-width: min(88vw, var(--dialog-width-lg));
  height: clamp(var(--dialog-height-lg-min), 85vh, var(--dialog-height-lg));
  max-height: none;
}
</style>
