<template>
  <iframe
    v-if="src"
    ref="frame"
    :src="src"
    :title="path"
    sandbox="allow-scripts"
    referrerpolicy="no-referrer"
    class="file-html"
  />

  <EmptyState v-else-if="failed" :title="t('rail.previewFailed')">
    <template #art><CircleExclamationPointIcon class="file-html-art" /></template>
    <template #actions><RetryButton :action="load" /></template>
  </EmptyState>

  <AlertDialog v-model:open="confirming">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t("files.openLinkTitle") }}</AlertDialogTitle>
        <AlertDialogDescription class="file-html-link">{{ link }}</AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter>
        <AlertDialogCancel>{{ t("common.cancel") }}</AlertDialogCancel>
        <AlertDialogAction @click="openLink">{{ t("files.openLink") }}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup lang="ts">
import { shallowRef, useTemplateRef, watch } from "vue"
import { isPreviewLinkMessage } from "@pig/protocol"
import { useEventListener } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { filePreviewToken } from "@client/platform.js"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@pig/ui/alert-dialog"
import { EmptyState } from "@pig/ui/empty-state"
import { CircleExclamationPointIcon } from "@components/icons/index.js"
import RetryButton from "@components/empty/RetryButton.vue"
import { useFilePane } from "@features/file-pane/index.js"

const props = defineProps<{ path: string; revision: number }>()
const { t } = useI18n()
const pane = useFilePane()
const frame = useTemplateRef("frame")
const src = shallowRef("")
const failed = shallowRef(false)
const link = shallowRef("")
const confirming = shallowRef(false)

let loadSeq = 0

async function load() {
  const seq = ++loadSeq
  const cwd = pane.cwd.value
  const { path, revision } = props

  if (!cwd) return

  try {
    const token = await filePreviewToken(cwd)
    const encoded = path.split("/").map(encodeURIComponent).join("/")

    if (seq !== loadSeq) return
    src.value = `/api/v1/preview/${token}/${encoded}?r=${revision}`
    failed.value = false
  } catch {
    if (seq === loadSeq) failed.value = true
  }
}

watch(
  () => [pane.cwd.value, props.path, props.revision] as const,
  () => {
    failed.value = false
    void load()
  },
  { immediate: true },
)

useEventListener(window, "message", (event: MessageEvent) => {
  if (event.source !== frame.value?.contentWindow || !isPreviewLinkMessage(event.data)) return
  link.value = event.data.href
  confirming.value = true
})

function openLink() {
  window.open(link.value, "_blank", "noopener,noreferrer")
}
</script>

<style scoped>
.file-html {
  flex: 1;
  inline-size: 100%;
  border: 0;
  background: var(--bg-surface);
}

.file-html-art {
  inline-size: var(--icon-xl);
  block-size: var(--icon-xl);
}

.file-html-link {
  overflow-wrap: anywhere;
}
</style>
