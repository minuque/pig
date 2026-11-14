<template>
  <div class="file-search">
    <TextFieldRoot
      v-model="query"
      class="file-search-field"
      size="s"
      variant="soft"
      color="gray"
      :placeholder="t('files.search')"
      :aria-label="t('files.search')"
      @keydown.escape="query = ''"
    >
      <TextFieldSlot side="left"><MagnifierIcon class="size-icon" /></TextFieldSlot>
    </TextFieldRoot>

    <slot v-if="!trimmed" />

    <div v-else class="file-search-results">
      <section v-if="names.length" class="file-search-group">
        <h3 class="file-search-heading">{{ t("files.nameMatches") }}</h3>

        <button
          v-for="entry in names"
          :key="entry.path"
          type="button"
          class="file-search-row"
          :title="entry.path"
          @click="pane.openFile(entry.path)"
          @dblclick="pane.openFile(entry.path, { pin: true })"
        >
          <span class="file-search-name">{{ pathBasename(entry.path) }}</span>
          <span class="file-search-dir">{{ parent(entry.path) }}</span>
        </button>
      </section>

      <section v-if="matches.length" class="file-search-group">
        <h3 class="file-search-heading">{{ t("files.contentMatches") }}</h3>

        <button
          v-for="match in matches"
          :key="`${match.path}:${match.line}`"
          type="button"
          class="file-search-row is-content"
          :title="`${match.path}:${match.line}`"
          @click="pane.openFile(match.path, { line: match.line })"
        >
          <span class="file-search-dir">{{ match.path }}:{{ match.line }}</span>
          <span class="file-search-text">{{ match.text }}</span>
        </button>
      </section>

      <div v-if="searching && !names.length && !matches.length" class="file-search-status">
        <Spinner :size="16" />
      </div>

      <p v-else-if="!searching && !names.length && !matches.length" class="file-search-empty">
        {{ t("files.noMatches") }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { searchWorkspaceContents, searchWorkspaceFiles } from "@client/platform.js"
import { Spinner } from "@components/ui/spinner/index.js"
import { TextFieldRoot, TextFieldSlot } from "@components/ui/text-field/index.js"
import { MagnifierIcon } from "@components/icons/index.js"
import { pathBasename } from "@features/transcript-view/lib/tool-summary.js"
import { useFilePane } from "@features/file-pane/index.js"
import type { ContentSearchMatch, FileSearchEntry } from "@/types/common-type.js"

/** 输入停顿多久再搜，免得每敲一个字就扫一遍工作区。 */
const DEBOUNCE_MS = 200
const { t } = useI18n()
const pane = useFilePane()
const query = shallowRef("")
const trimmed = computed(() => query.value.trim())
const names = shallowRef<FileSearchEntry[]>([])
const matches = shallowRef<ContentSearchMatch[]>([])
const searching = shallowRef(false)
const parent = (path: string) => path.split("/").slice(0, -1).join("/")

watch([trimmed, () => pane.cwd.value], ([text, cwd], _, onCleanup) => {
  const controller = new AbortController()
  const timer = setTimeout(() => void run(text, cwd, controller.signal), DEBOUNCE_MS)
  onCleanup(() => {
    clearTimeout(timer)
    controller.abort()
  })
})

async function run(text: string, cwd: string | undefined, signal: AbortSignal) {
  names.value = []
  matches.value = []

  if (!text || !cwd) return
  searching.value = true

  const files = searchWorkspaceFiles(cwd, text, signal)
    .then((entries) => {
      if (!signal.aborted) names.value = entries.filter((entry) => entry.kind === "file")
    })
    .catch(() => undefined)
  const contents = searchWorkspaceContents(cwd, text, signal)
    .then((result) => {
      if (!signal.aborted) matches.value = result.matches
    })
    .catch(() => undefined)

  await Promise.all([files, contents])

  if (!signal.aborted) searching.value = false
}
</script>

<style scoped>
.file-search {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-block-size: 0;
}

.file-search-field {
  flex-shrink: 0;
  margin: var(--space-xs) var(--space-xs) var(--space-xxs);
}

.file-search-results {
  flex: 1;
  min-block-size: 0;
  padding: 0 var(--space-xs) var(--space-sm);
  overflow: auto;
}

.file-search-group + .file-search-group {
  margin-block-start: var(--space-sm);
}

.file-search-heading {
  margin: 0;
  padding: var(--space-xxs) var(--space-xs);
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
}

.file-search-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  inline-size: 100%;
  padding: var(--space-xxs) var(--space-xs);
  border: 0;
  border-radius: var(--radius-control);
  background: none;
  color: var(--contrast-foreground);
  font: inherit;
  font-size: var(--text-body);
  text-align: start;
  white-space: nowrap;
}

.file-search-row.is-content {
  flex-direction: column;
  gap: 0;
}

.file-search-row:hover {
  background: var(--btn-hover);
}

.file-search-row:focus-visible {
  outline: var(--focus-ring);
  outline-offset: -2px;
}

.file-search-name,
.file-search-text {
  max-inline-size: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-search-text {
  font-family: var(--font-mono);
  font-size: var(--text-code);
}

.file-search-dir {
  min-inline-size: 0;
  overflow: hidden;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
  text-overflow: ellipsis;
}

.file-search-status {
  display: grid;
  padding: var(--space-md);
  place-items: center;
}

.file-search-empty {
  margin: 0;
  padding: var(--space-md) var(--space-xs);
  color: var(--contrast-foreground-faint);
  font-size: var(--text-body);
  text-align: center;
}
</style>
