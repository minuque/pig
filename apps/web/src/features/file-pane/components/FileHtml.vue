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

  <FileNotice v-else-if="failed" :text="t('files.loadFailed')" />

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
} from "@components/ui/alert-dialog/index.js"
import FileNotice from "@features/file-pane/components/FileNotice.vue"
import { useFilePane } from "@features/file-pane/index.js"

/** 沙箱里的页面没有 cookie：地址带上预览令牌，相对路径的资源也走同一前缀。 */
const props = defineProps<{ path: string; revision: number }>()
const { t } = useI18n()
const pane = useFilePane()
const frame = useTemplateRef("frame")
const src = shallowRef("")
const failed = shallowRef(false)
const link = shallowRef("")
const confirming = shallowRef(false)

watch(
  () => [pane.cwd.value, props.path, props.revision] as const,
  async ([cwd, path, revision], _, onCleanup) => {
    let active = true
    onCleanup(() => (active = false))
    failed.value = false

    if (!cwd) return

    try {
      const token = await filePreviewToken(cwd)
      const encoded = path.split("/").map(encodeURIComponent).join("/")

      if (active) src.value = `/api/v1/preview/${token}/${encoded}?r=${revision}`
    } catch {
      if (active) failed.value = true
    }
  },
  { immediate: true },
)

// 页面里点到外链时，注入的脚本把地址发上来，先问一句再打开
useEventListener(window, "message", (event: MessageEvent) => {
  const data = event.data as { type?: unknown; href?: unknown } | null

  if (event.source !== frame.value?.contentWindow || data?.type !== "pig-preview-link") return

  if (typeof data.href !== "string" || !/^https?:\/\//i.test(data.href)) return
  link.value = data.href
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
  background: var(--surface);
}

.file-html-link {
  overflow-wrap: anywhere;
}
</style>
