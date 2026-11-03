<template>
  <span class="file-tag" :class="{ plain }" :title="title || path">
    <!-- 有语言徽标就只出徽标；文件名留给读屏，视觉上不重复占位 -->
    <img v-if="iconUrl" class="file-tag-icon" :src="iconUrl" alt="" />
    <span v-if="iconUrl" class="sr-only">{{ text }}</span>
    <span v-else class="file-tag-name">{{ text }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { getLanguageIcon, languageIconsRevision } from "markstream-vue"
import { fileLanguage } from "@features/transcript-view/lib/tool-summary.js"

const props = defineProps<{
  /** 完整路径：定语言徽标，没有 title 时兼作悬浮提示。 */
  path: string
  /** 没有语言徽标时才显示：工具行用文件名，卡片头用完整路径。 */
  text: string
  title?: string
  /** 卡片头变体：保留图标与等宽字，去掉背景胶囊。 */
  plain?: boolean
}>()
const iconUrl = computed(() => {
  void languageIconsRevision.value
  const language = fileLanguage(props.path)

  if (language === "text") return ""
  const icon = getLanguageIcon(language)
  return icon ? `data:image/svg+xml;utf8,${encodeURIComponent(icon)}` : ""
})
</script>

<style scoped>
.file-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  padding: 2px var(--space-xs);
  border-radius: var(--radius-sm);
  background: var(--hover-tint);
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
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
  color: var(--contrast-foreground);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-tag.plain {
  padding: 0;
  background: transparent;
}
</style>
