<template>
  <Dialog v-model:open="open">
    <DialogContent
      v-if="file"
      class="asset-dialog"
      max-width="min(88vw, 48rem)"
      initial-focus="content"
    >
      <div class="asset-head">
        <DialogTitle class="asset-title">{{ file }}</DialogTitle>
        <DialogDescription v-if="meta" class="asset-meta">{{ meta }}</DialogDescription>
      </div>

      <div v-if="loading" class="asset-state">
        <Spinner size="s" :label="t('settings.skills.assetLoading')" />
        <span>{{ t("settings.skills.assetLoading") }}</span>
      </div>

      <Banner v-else-if="loadError" color="danger" variant="surface" size="s">
        {{ loadError }}
      </Banner>

      <Banner v-else-if="asset?.binary" color="warning" variant="surface" size="s">
        {{ t("files.binary") }}
      </Banner>

      <Banner v-else-if="asset?.tooLarge" color="warning" variant="surface" size="s">
        {{ t("files.tooLarge") }}
      </Banner>

      <p v-else-if="asset && !textContent" class="asset-empty">
        {{ t("settings.skills.assetEmpty") }}
      </p>

      <div v-else-if="asset && isMarkdown" class="asset-markdown">
        <MarkdownContent :nodes="nodes" />
      </div>

      <div v-else-if="asset" class="asset-code">
        <p v-if="plain" class="asset-notice">{{ t("files.plainNotice") }}</p>

        <div class="asset-lines">
          <div v-for="(line, index) in lines" :key="index" class="asset-line">
            <span class="asset-number">{{ index + 1 }}</span>
            <code v-if="tokens[index]" v-token-line="tokens[index]" />
            <code v-else>{{ line }}</code>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue"
import type { FileTextResponse } from "@pig/protocol"

import { errorMessage } from "@client/http.js"
import type { SkillsState } from "@features/settings/hooks/use-skills.js"
import { formatByteSize } from "@features/settings/lib/mcp-tool-schema.js"
import { useColorScheme } from "@features/theme/index.js"
import MarkdownContent from "@features/transcript-view/components/markdown/MarkdownContent.vue"
import { useMarkdownNodes } from "@features/transcript-view/hooks/use-markdown-nodes.js"
import {
  highlightCodeTokens,
  vTokenLine,
  type CodeTokens,
} from "@features/transcript-view/lib/code-highlight.js"
import { fileLanguage } from "@features/transcript-view/lib/tool-summary.js"
import { useI18n } from "@i18n/index.js"
import { Banner } from "@pig/ui/banner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@pig/ui/dialog"
import { Spinner } from "@pig/ui/spinner"

const MAX_CODE_UNITS = 100_000
const MAX_LINES = 2_000
const MAX_LINE_UNITS = 1_000
const props = defineProps<{
  state: SkillsState
  skillPath: string
  file: string | undefined
}>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const { codeBlockProps } = useColorScheme()
const loading = ref(false)
const loadError = ref<string>()
const asset = shallowRef<FileTextResponse>()
const tokens = shallowRef<CodeTokens>([])
let seq = 0
const open = computed({
  get: () => Boolean(props.file),
  set: (next: boolean) => {
    if (!next) emit("close")
  },
})
const extension = computed(() => props.file?.split(".").pop()?.toLowerCase() ?? "")
const isMarkdown = computed(() => extension.value === "md" || extension.value === "mdx")
const language = computed(() => (props.file ? fileLanguage(props.file) : "text"))
const textContent = computed(() => asset.value?.content ?? "")
const lines = computed(() => textContent.value.split(/\r\n|\n|\r/))
const plain = computed(
  () =>
    language.value !== "text" &&
    (textContent.value.length > MAX_CODE_UNITS ||
      lines.value.length > MAX_LINES ||
      lines.value.some((line) => line.length > MAX_LINE_UNITS)),
)
const meta = computed(() => {
  if (!asset.value) return ""
  const size = formatByteSize(asset.value.size)
  return language.value === "text" ? size : `${extension.value} · ${size}`
})
const nodes = useMarkdownNodes({
  text: () => (isMarkdown.value ? textContent.value : ""),
  streaming: () => false,
  cacheKey: () => `skill-asset:${props.skillPath}:${props.file ?? ""}:${textContent.value.length}`,
})

watch(
  () => [props.skillPath, props.file] as const,
  async ([skillPath, file]) => {
    const id = ++seq

    asset.value = undefined
    loadError.value = undefined
    tokens.value = []

    if (!file) {
      loading.value = false
      return
    }

    loading.value = true

    try {
      const next = await props.state.readAsset(skillPath, file)

      if (id === seq) asset.value = next
    } catch (cause) {
      if (id === seq) loadError.value = errorMessage(cause)
    } finally {
      if (id === seq) loading.value = false
    }
  },
  { immediate: true },
)

watch(
  () =>
    [
      textContent.value,
      isMarkdown.value,
      language.value,
      plain.value,
      codeBlockProps.value.theme,
    ] as const,
  async ([code, md, lang, isPlain, theme], _, onCleanup) => {
    let active = true

    onCleanup(() => (active = false))

    if (!code || md || lang === "text" || isPlain) {
      tokens.value = []
      return
    }

    const next = await highlightCodeTokens(code, lang, theme).catch(() => [])

    if (active) tokens.value = next
  },
  { immediate: true },
)
</script>

<style scoped>
.asset-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.asset-head {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.asset-title {
  padding-inline-end: var(--control-md);
  font-family: var(--font-mono);
  overflow-wrap: anywhere;
}

.asset-meta,
.asset-state,
.asset-empty,
.asset-notice {
  margin: 0;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

.asset-state {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding-block: var(--space-md);
}

.asset-markdown,
.asset-code {
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-control);
  background: var(--bg-surface);
  background-clip: padding-box;
  max-block-size: 62vh;
  overflow: auto;
}

.asset-markdown {
  padding: var(--space-sm) var(--space-md);
}

.asset-code {
  font-size: var(--text-code);
}

.asset-notice {
  padding: var(--space-xs) var(--space-md);
  border-block-end: var(--border-width) solid var(--border-subtle);
}

.asset-lines {
  min-inline-size: max-content;
  padding-block: var(--space-xs);
  font-family: var(--font-mono);
  line-height: var(--text-code-line);
  tab-size: 2;
  text-autospace: no-autospace;
  text-spacing-trim: space-all;
}

.asset-line {
  display: flex;
  gap: var(--space-sm);
  min-block-size: var(--text-code-line);
  padding-inline-end: var(--space-md);
  white-space: pre;
}

.asset-number {
  position: sticky;
  left: 0;
  flex: none;
  min-inline-size: 3.5ch;
  padding-inline: var(--space-md) 0;
  box-sizing: content-box;
  background: var(--bg-surface);
  color: var(--fg-muted);
  text-align: right;
  user-select: none;
}
</style>
