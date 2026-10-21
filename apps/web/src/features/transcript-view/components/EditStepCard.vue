<template>
  <div class="tool-step-card is-edit">
    <ToolHeader v-model:soft-wrap="softWrap" :label="t('transcript.output')" :text="outputText">
      <div class="read-heading">
        <TranscriptFileTag :path="heading" :text="heading" plain />
      </div>
    </ToolHeader>

    <div class="edit-area" :class="{ 'is-clamped': clamped }">
      <StreamDiff
        v-for="(hunk, index) in shownHunks"
        :key="index"
        class="edit-diff"
        :class="{ 'is-soft-wrap': softWrap }"
        :original="hunk.original"
        :modified="hunk.modified"
        :language="preview.language"
        :file-name="preview.fileName"
        diff-style="unified"
        :options="editDiffOptions"
      />
    </div>

    <div class="card-footer">
      <span v-if="preview.removed" class="removed">-{{ preview.removed }}</span>
      <span v-if="preview.added" class="added">+{{ preview.added }}</span>
      <span>{{ t("transcript.editHunks", { count: preview.hunks.length }) }}</span>

      <button
        v-if="clamped || expanded"
        type="button"
        class="footer-toggle"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{
          expanded
            ? t("common.collapse")
            : t("transcript.showAllLines", {
                count: preview.hunks.reduce((s, h) => s + hunkLines(h), 0),
              })
        }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "@i18n/index.js"
import { StreamDiff } from "stream-diffs/vue"
import ToolHeader from "@features/transcript-view/components/ToolHeader.vue"
import TranscriptFileTag from "@features/transcript-view/components/TranscriptFileTag.vue"
import { useColorScheme } from "@features/theme/index.js"
import type { EditDiffPreview } from "@features/transcript-view/type.js"

const { t } = useI18n()
const props = defineProps<{
  preview: EditDiffPreview
  outputText: string
}>()
const heading = computed(() => props.preview.path || props.preview.fileName || "")
const softWrap = ref(true)
const expanded = ref(false)
const PREVIEW_LINES = 8
const hunkLines = (hunk: { original: string; modified: string }) =>
  hunk.original.split("\n").length + hunk.modified.split("\n").length
const shownHunks = computed(() => {
  if (expanded.value) return props.preview.hunks
  let lines = 0
  return props.preview.hunks.filter((hunk) => {
    const n = hunkLines(hunk)

    if (lines >= PREVIEW_LINES) return false
    lines += n
    return true
  })
})
const clamped = computed(
  () => !expanded.value && shownHunks.value.length < props.preview.hunks.length,
)
const { codeBlockProps } = useColorScheme()
const editDiffOptions = computed(() => ({
  theme: codeBlockProps.value.theme,
  disableFileHeader: true,
}))
</script>

<style scoped>
.tool-step-card {
  min-width: 0;
  max-width: 100%;
  overflow: visible;
  border-radius: var(--radius-code);
  background: var(--code-surface);
  box-shadow: var(--shadow-card);
}

.is-edit :deep(.tool-header) {
  border-bottom-color: var(--border-subtle);
}

.read-heading {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
}

.card-footer {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: var(--size-icon-button);
  padding: 0 var(--spacing-sm);
  border-top: var(--border-width) solid var(--border-subtle);
  color: var(--contrast-foreground-faint);
  font-family: var(--font-mono);
  font-size: var(--text-caption-mono);
  font-variant-numeric: tabular-nums;
}

.footer-toggle {
  margin-inline-start: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--contrast-foreground);
  font: inherit;
  cursor: pointer;
}

.footer-toggle:hover {
  color: var(--contrast-foreground);
}

.edit-area.is-clamped {
  max-height: calc(var(--text-code-line) * 8 + var(--spacing-xs) * 2);
  overflow: hidden;
  mask-image: linear-gradient(to bottom, black calc(100% - 2.5rem), transparent);
}

.added {
  color: var(--success);
}

.removed {
  color: var(--destructive);
}

.edit-diff {
  max-width: 100%;
  overflow: visible;
}

.edit-diff.is-soft-wrap :deep(pre),
.edit-diff.is-soft-wrap :deep(code) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.edit-diff :deep(.stream-diffs-vue-diff) {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.edit-diff + .edit-diff {
  border-top: var(--border-width) solid var(--border-subtle);
}
</style>
