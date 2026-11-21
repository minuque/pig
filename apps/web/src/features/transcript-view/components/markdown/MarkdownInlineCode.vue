<template>
  <MarkdownFileLink v-if="path" :path="path" />
  <code v-else><slot /></code>
</template>

<script setup lang="ts">
import { computed, inject } from "vue"
import type { ElementNode } from "comark"
import { textContent } from "comark/utils"
import MarkdownFileLink from "@features/transcript-view/components/markdown/MarkdownFileLink.vue"
import { inlineCodeFilePath } from "@features/transcript-view/lib/file-link.js"
import { openFileKey } from "@features/transcript-view/index.js"

const props = defineProps<{ __node: ElementNode }>()
const fileOpener = inject(openFileKey, undefined)
const path = computed(() => {
  const candidate = inlineCodeFilePath(textContent(props.__node))
  return candidate && fileOpener?.accepts(candidate) ? candidate : null
})
</script>
