<template>
  <div class="file-search">
    <TextFieldRoot
      ref="field"
      v-model="query"
      class="file-search-field"
      size="s"
      variant="soft"
      color="neutral"
      :placeholder="t('files.search')"
      :aria-label="t('files.search')"
      @keydown.escape="query = ''"
    >
      <TextFieldSlot side="left"><SearchIcon class="size-icon" /></TextFieldSlot>
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

      <p v-if="notice" class="file-search-limit">
        {{
          notice.key === "files.limitResults"
            ? t(notice.key, { count: notice.count })
            : t(notice.key)
        }}
      </p>

      <div v-if="searching && !names.length && !matches.length" class="file-search-status">
        <Spinner size="m" />
      </div>

      <EmptyState
        v-else-if="!searching && !names.length && !matches.length"
        size="row"
        live
        class="file-search-empty"
        :title="t('files.noMatches', { query: trimmed })"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { searchWorkspaceContents, searchWorkspaceFiles } from "@client/platform.js"
import { EmptyState } from "@pig/ui/empty-state"
import { Spinner } from "@pig/ui/spinner"
import { TextFieldRoot, TextFieldSlot } from "@pig/ui/text-field"
import { SearchIcon } from "@components/icons/index.js"
import { pathBasename } from "@features/transcript-view/lib/tool-summary.js"
import { useFilePane } from "@features/file-pane/index.js"
import { searchLimitNotice } from "@features/file-pane/lib/search-limit.js"
import type { ContentSearchMatch, FileSearchEntry, SearchTruncation } from "@/types/common-type.js"

const DEBOUNCE_MS = 200
const { t } = useI18n()
const pane = useFilePane()
const query = shallowRef("")
const trimmed = computed(() => query.value.trim())
const names = shallowRef<FileSearchEntry[]>([])
const matches = shallowRef<ContentSearchMatch[]>([])
const reasons = shallowRef<SearchTruncation[]>([])
const notice = computed(() => searchLimitNotice(reasons.value, matches.value.length))
const searching = shallowRef(false)
const parent = (path: string) => path.split("/").slice(0, -1).join("/")
const field = useTemplateRef<{ focus: () => void }>("field")

watch(pane.searchRequest, () => field.value?.focus())

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
  reasons.value = []

  if (!text || !cwd) return
  searching.value = true

  const files = searchWorkspaceFiles(cwd, text, signal)
    .then((entries) => {
      if (!signal.aborted) names.value = entries.filter((entry) => entry.kind === "file")
    })
    .catch(() => undefined)
  const contents = searchWorkspaceContents(cwd, text, signal)
    .then((result) => {
      if (signal.aborted) return
      matches.value = result.matches
      reasons.value = result.truncationReasons
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
  margin: var(--space-xs) var(--space-xs) var(--space-2xs);
}

.file-search-results {
  flex: 1;
  min-block-size: 0;
  padding: 0 var(--space-xs) var(--space-sm);
  overflow: auto;
  overscroll-behavior: contain;
}

.file-search-group + .file-search-group {
  margin-block-start: var(--space-sm);
}

.file-search-heading {
  margin: 0;
  padding: var(--space-2xs) var(--space-xs);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
}

.file-search-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  inline-size: 100%;
  padding: var(--space-2xs) var(--space-xs);
  border: 0;
  border-radius: var(--radius-control);
  background: none;
  color: var(--fg);
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
  background: var(--bg-hover);
}

.file-search-row:focus-visible {
  outline: 2px solid var(--focus-color);
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
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  text-overflow: ellipsis;
}

.file-search-limit {
  margin: 0;
  padding: var(--space-xs);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  user-select: none;
}

.file-search-status {
  display: grid;
  padding: var(--space-md);
  place-items: center;
}

.file-search-empty {
  padding-inline: var(--space-sm);
}
</style>
