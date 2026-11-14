<template>
  <div v-if="loading" class="ctx-preview-status"><Spinner :size="24" /></div>
  <pre v-else class="ctx-preview-text">{{ body }}</pre>
</template>

<script setup lang="ts">
import { ref, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { contextPreview } from "@client/platform.js"
import { Spinner } from "@components/ui/spinner/index.js"
import type { ContextUsageSegment } from "@features/composer/type.js"

const props = defineProps<{ sessionId: string; segment: ContextUsageSegment }>()
const emit = defineEmits<{ title: [title: string] }>()
const { t } = useI18n()
const loading = ref(false)
const body = ref("")

/** 取这一类实际进上下文的内容；连点只认最后一次。 */
watch(
  () => [props.sessionId, props.segment.id] as const,
  async ([sessionId, segmentId], _, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })
    loading.value = true
    body.value = ""

    try {
      const preview = await contextPreview(sessionId, segmentId)

      if (!active) return

      if (preview?.title) emit("title", preview.title)
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

.ctx-preview-text {
  margin: 0;
  color: var(--contrast-foreground);
  font: inherit;
  font-size: var(--text-body);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
