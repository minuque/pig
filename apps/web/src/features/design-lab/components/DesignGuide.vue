<template>
  <div class="guide">
    <MarkdownContent :nodes="nodes" />
  </div>
</template>

<script setup lang="ts">
import MarkdownContent from "@features/transcript-view/components/markdown/MarkdownContent.vue"
import { useMarkdownNodes } from "@features/transcript-view/hooks/use-markdown-nodes.js"
import guide from "../../../../../../docs/DESIGN.md?raw"

const body = guide.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
const nodes = useMarkdownNodes({
  text: () => body,
  streaming: () => false,
  cacheKey: () => "design-guide",
})
</script>

<style scoped>
.guide {
  max-inline-size: var(--content-width);
}
</style>
