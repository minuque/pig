<template>
  <span class="file-tag" :title="title || path">
    <img v-if="iconUrl" class="file-tag-icon" :src="iconUrl" :alt="extension" />
    <span class="file-tag-name">{{ text }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { getLanguageIcon, languageIconsRevision } from "markstream-vue"
import { fileLanguage, pathBasename } from "@features/transcript-view/lib/tool-summary.js"

const props = defineProps<{
  /** 完整路径：扩展名定图标与 alt，没有 title 时兼作悬浮提示。 */
  path: string
  /** 显示文本：工具行用文件名，卡片头用完整路径。 */
  text: string
  title?: string
}>()
const extension = computed(() => {
  const name = pathBasename(props.path)
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(dot + 1).toUpperCase() : ""
})
const iconUrl = computed(() => {
  void languageIconsRevision.value
  const language = fileLanguage(props.path)

  if (language === "text") return ""
  return `data:image/svg+xml;utf8,${encodeURIComponent(getLanguageIcon(language))}`
})
</script>

<style scoped>
.file-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  padding: 2px var(--spacing-xs);
  border-radius: var(--radius-sm);
  background: var(--hover-tint);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}

.file-tag-icon {
  display: block;
  flex: none;
  width: var(--size-icon);
  height: var(--size-icon);
}

.file-tag-name {
  min-width: 0;
  overflow: hidden;
  color: var(--ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
