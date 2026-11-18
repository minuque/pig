<template>
  <MarkdownContent :nodes="nodes" />
</template>

<script setup lang="ts">
import MarkdownContent from "@features/transcript-view/components/markdown/MarkdownContent.vue"
import { useMarkdownNodes } from "@features/transcript-view/hooks/use-markdown-nodes.js"
import guide from "../../../../DESIGN.md?raw"

// 渲染仓库里的 DESIGN.md，去掉给工具读的 YAML 头
const body = guide.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
const nodes = useMarkdownNodes({
  text: () => body,
  streaming: () => false,
  cacheKey: () => "design-guide",
})
</script>
