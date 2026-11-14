<template>
  <div class="file-viewer">
    <div class="file-viewer-sub">
      <nav class="file-viewer-crumbs" :aria-label="path">
        <span v-for="(part, index) in crumbs" :key="index" class="file-viewer-crumb">
          {{ part }}
        </span>
      </nav>

      <Tooltip v-if="previewable && loaded?.content !== undefined">
        <TooltipTrigger as-child>
          <IconButton
            type="button"
            size="s"
            variant="ghost"
            color="gray"
            :aria-label="toggleLabel"
            @click="source = !source"
          >
            <CodeSquareIcon v-if="!source" class="size-icon" />
            <EyeIcon v-else class="size-icon" />
          </IconButton>
        </TooltipTrigger>

        <TooltipContent>{{ toggleLabel }}</TooltipContent>
      </Tooltip>
    </div>

    <img v-if="kind === 'image'" :src="rawUrl" :alt="path" class="file-viewer-image" />
    <video v-else-if="kind === 'video'" :src="rawUrl" controls class="file-viewer-media" />
    <audio v-else-if="kind === 'audio'" :src="rawUrl" controls class="file-viewer-audio" />
    <iframe v-else-if="kind === 'pdf'" :src="rawUrl" :title="path" class="file-viewer-pdf" />
    <div v-else-if="loading" class="file-viewer-status"><Spinner :size="24" /></div>
    <FileNotice v-else-if="failure" :text="failure" />

    <FileNotice
      v-else-if="loaded?.binary && loaded.content === undefined"
      :text="t('files.binary')"
      :action="t('files.viewAsText')"
      @action="load(true)"
    />

    <FileNotice v-else-if="loaded?.tooLarge" :text="t('files.tooLarge')" />

    <div v-else-if="kind === 'markdown' && !source" class="file-viewer-doc">
      <MarkdownContent :nodes="nodes" />
    </div>

    <FileHtml
      v-else-if="kind === 'html' && !source"
      :path="path"
      :revision="pane.revisions.value[path] ?? 0"
    />

    <FileTable v-else-if="kind === 'csv' && !source" :path="path" :text="loaded?.content ?? ''" />

    <!-- SVG 当图片画：data URL 里的脚本不会执行 -->
    <img
      v-else-if="kind === 'svg' && !source && loaded?.content !== undefined"
      :src="svgUrl"
      :alt="path"
      class="file-viewer-image"
    />

    <FileCode v-else-if="loaded" :path="path" :text="loaded.content ?? ''" :range="range" />
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { fileRawUrl, readWorkspaceFile } from "@client/platform.js"
import { PlatformRequestError } from "@client/http.js"
import { IconButton } from "@components/ui/button/index.js"
import { Spinner } from "@components/ui/spinner/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { CodeSquareIcon, EyeIcon } from "@components/icons/index.js"
import MarkdownContent from "@features/transcript-view/components/markdown/MarkdownContent.vue"
import { useMarkdownNodes } from "@features/transcript-view/hooks/use-markdown-nodes.js"
import FileCode from "@features/file-pane/components/FileCode.vue"
import FileHtml from "@features/file-pane/components/FileHtml.vue"
import FileNotice from "@features/file-pane/components/FileNotice.vue"
import FileTable from "@features/file-pane/components/FileTable.vue"
import { fileViewKind } from "@features/file-pane/lib/file-kind.js"
import { locateLines } from "@features/file-pane/lib/paths.js"
import { useFilePane } from "@features/file-pane/index.js"
import type { FileTextResponse } from "@/types/common-type.js"

/** 这些类型直接从字节地址加载，不读文本。 */
const MEDIA = new Set(["image", "video", "audio", "pdf"])
const props = defineProps<{ path: string }>()
const { t } = useI18n()
const pane = useFilePane()
const kind = computed(() => fileViewKind(props.path))
const crumbs = computed(() => props.path.split(/[\\/]/).filter(Boolean))
const rawUrl = computed(() => (pane.cwd.value ? fileRawUrl(pane.cwd.value, props.path) : ""))
const loaded = shallowRef<FileTextResponse>()
const loading = shallowRef(false)
const failure = shallowRef("")
/** Markdown 默认渲染；带行号打开时从源码开始。 */
const source = shallowRef(false)
const previewable = computed(() => ["markdown", "csv", "svg", "html"].includes(kind.value))
const svgUrl = computed(
  () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(loaded.value?.content ?? "")}`,
)
const toggleLabel = computed(() => (source.value ? t("files.preview") : t("files.viewSource")))
const nodes = useMarkdownNodes({
  text: () => (kind.value === "markdown" ? (loaded.value?.content ?? "") : ""),
  streaming: () => false,
  cacheKey: () => `file:${pane.cwd.value ?? ""}/${props.path}`,
})
const range = computed(() => {
  const request = pane.request.value

  if (request?.path !== props.path) return undefined

  const found =
    request.find && loaded.value?.content !== undefined
      ? locateLines(loaded.value.content, request.find)
      : undefined
  const line = found?.line ?? request.line

  if (line === undefined) return undefined
  return { line, endLine: found?.endLine ?? request.endLine ?? line, seq: request.seq }
})
let loadSeq = 0

async function load(force = false, quiet = false) {
  const cwd = pane.cwd.value

  if (!cwd || MEDIA.has(kind.value)) return

  const seq = ++loadSeq

  if (!quiet) loading.value = true
  failure.value = ""

  try {
    const result = await readWorkspaceFile(cwd, props.path, force)

    if (seq === loadSeq) loaded.value = result
  } catch (error) {
    if (seq !== loadSeq) return
    loaded.value = undefined
    failure.value =
      error instanceof PlatformRequestError && error.code === "NOT_FOUND"
        ? t("files.missing")
        : t("files.loadFailed")
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

watch(
  () => [props.path, pane.cwd.value] as const,
  () => {
    loaded.value = undefined
    source.value = false
    void load()
  },
  { immediate: true },
)

watch(
  range,
  (next) => {
    if (next && previewable.value) source.value = true
  },
  { immediate: true },
)

// agent 改过这个文件就静默重读，滚动位置留在原处
watch(
  () => pane.revisions.value[props.path],
  (next, prev) => {
    if (next !== prev) void load(false, true)
  },
)
</script>

<style scoped>
.file-viewer {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-block-size: 0;
}

.file-viewer-sub {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-xs);
  min-block-size: var(--size-icon-button);
  padding: 0 var(--space-xs) 0 var(--space-md);
}

.file-viewer-crumbs {
  display: flex;
  flex: 1;
  min-inline-size: 0;
  overflow: hidden;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
  white-space: nowrap;
}

.file-viewer-crumb + .file-viewer-crumb::before {
  content: "/";
  padding-inline: var(--space-xxs);
}

.file-viewer-crumb:last-child {
  color: var(--contrast-foreground-secondary);
}

.file-viewer-status {
  display: grid;
  flex: 1;
  place-items: center;
}

.file-viewer-doc {
  flex: 1;
  min-block-size: 0;
  padding: var(--space-sm) var(--space-lg) var(--space-lg);
  overflow: auto;
}

.file-viewer-media {
  display: block;
  max-inline-size: calc(100% - 2 * var(--space-md));
  max-block-size: calc(100% - 2 * var(--space-md));
  margin: auto;
  border-radius: var(--radius-card);
}

.file-viewer-audio {
  inline-size: calc(100% - 2 * var(--space-md));
  margin: auto;
}

.file-viewer-pdf {
  flex: 1;
  inline-size: 100%;
  border: 0;
}

.file-viewer-image {
  display: block;
  max-inline-size: calc(100% - 2 * var(--space-md));
  max-block-size: calc(100% - 2 * var(--space-md));
  margin: auto;
  object-fit: contain;
  border-radius: var(--radius-card);
  outline: var(--border-width) solid var(--border-soft);
  outline-offset: -1px;
}
</style>
