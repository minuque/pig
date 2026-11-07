<template>
  <Suspense>
    <div class="prose">
      <MarkdownDocument
        v-for="(node, index) in nodes"
        :key="index"
        :value="blockDocument(node)"
        :components="components"
      />
    </div>
  </Suspense>
</template>

<script lang="ts">
import { h, type FunctionalComponent } from "vue"
import type { MarkdownDocument as ComarkDocument, Node } from "comark"
import { TableBody, TableCell, TableHeader, TableRow } from "@components/ui/table/index.js"
import MarkdownCodeBlock from "@features/transcript-view/components/markdown/MarkdownCodeBlock.vue"
import MarkdownLink from "@features/transcript-view/components/markdown/MarkdownLink.vue"
import MarkdownTable from "@features/transcript-view/components/markdown/MarkdownTable.vue"
import RevealWords from "@features/transcript-view/components/markdown/RevealWords.vue"
import { REVEAL_TAG } from "@features/transcript-view/lib/response-reveal.js"

const ColumnHeaderCell: FunctionalComponent = (_, { attrs, slots }) =>
  h(TableCell, { ...attrs, kind: "column-header" }, slots)
const components = {
  pre: MarkdownCodeBlock,
  a: MarkdownLink,
  table: MarkdownTable,
  thead: TableHeader,
  tbody: TableBody,
  tr: TableRow,
  th: ColumnHeaderCell,
  td: TableCell,
  [REVEAL_TAG]: RevealWords,
}
const documents = new WeakMap<object, ComarkDocument>()

/** 每个根块一份稳定的文档对象：props 不变，Vue 就跳过已写完的块。 */
function blockDocument(node: Node): ComarkDocument {
  if (typeof node === "string") return { nodes: [node], frontmatter: {}, meta: {} }
  const hit = documents.get(node)

  if (hit) return hit
  const created = { nodes: [node], frontmatter: {}, meta: {} }
  documents.set(node, created)
  return created
}
</script>

<script setup lang="ts">
import { provide, toRef } from "vue"
import { MarkdownDocument } from "@comark/vue"
import { LIVE_BLOCK } from "@features/transcript-view/components/markdown/live-block.js"

const props = defineProps<{ nodes: Node[]; streaming?: boolean }>()

provide(
  LIVE_BLOCK,
  toRef(() => (props.streaming ? props.nodes.at(-1) : undefined)),
)
</script>

<style scoped>
.prose :deep(.comark-content) {
  display: contents;
}
</style>
