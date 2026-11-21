<template>
  <PreviewDialog v-model:open="open" class="ctx-preview-dialog" :title="title">
    <template #actions>
      <Tooltip v-if="!loading">
        <TooltipTrigger as-child>
          <IconButton
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
        </TooltipTrigger>

        <TooltipContent>{{ toggleLabel }}</TooltipContent>
      </Tooltip>
    </template>

    <div v-if="loading" class="ctx-preview-status"><Spinner :size="24" /></div>
    <FileCode v-else-if="source" path="context.md" :text="body" />
    <MarkdownContent v-else :nodes="nodes" />
  </PreviewDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { contextPreview } from "@client/platform.js"
import { IconButton } from "@components/ui/button/index.js"
import { Spinner } from "@components/ui/spinner/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { EyeIcon, SquareCodeIcon } from "@components/icons/index.js"
import FileCode from "@features/file-pane/components/FileCode.vue"
import PreviewDialog from "@features/preview/index.vue"
import MarkdownContent from "@features/transcript-view/components/markdown/MarkdownContent.vue"
import { useMarkdownNodes } from "@features/transcript-view/hooks/use-markdown-nodes.js"
import type { ContextUsageSegment } from "@features/composer/type.js"

const props = defineProps<{ sessionId: string; segment: ContextUsageSegment }>()
const open = defineModel<boolean>("open", { default: false })
const { t } = useI18n()
const loading = ref(false)
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

watch(
  () => [props.sessionId, props.segment.id] as const,
  async ([sessionId, segmentId], _, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })
    loading.value = true
    body.value = ""
    loadedTitle.value = ""

    try {
      const preview = await contextPreview(sessionId, segmentId)

      if (!active) return
      loadedTitle.value = preview?.title ?? ""
      body.value = preview?.content || t("rail.previewEmpty")
    } catch {
      if (active) body.value = t("rail.previewFailed")
    } finally {
      if (active) loading.value = false
    }
  },
  { immediate: true },
)
</script>

<style scoped>
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
