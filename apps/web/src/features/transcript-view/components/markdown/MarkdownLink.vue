<template>
  <TranscriptLinkChip v-if="external" :url="href" :label="label" />
  <Link v-else-if="href.startsWith('#')" :href="href" underline="hover"><slot /></Link>
  <MarkdownFileLink v-else-if="isFile && isFileLinkLabel(text, href)" :path="href" />

  <span v-else-if="isFile">
    <slot />
    <MarkdownFileLink :path="href" />
  </span>

  <span v-else><slot /></span>
</template>

<script setup lang="ts">
import { computed, inject } from "vue"
import type { ElementNode } from "comark"
import { textContent } from "comark/utils"
import { Link } from "@pig/ui/link"
import TranscriptLinkChip from "@features/transcript-view/components/TranscriptLinkChip.vue"
import MarkdownFileLink from "@features/transcript-view/components/markdown/MarkdownFileLink.vue"
import { isFileLinkLabel } from "@features/transcript-view/lib/file-link.js"
import { linkChipLabel } from "@features/transcript-view/lib/link-chip.js"
import { openFileKey } from "@features/transcript-view/index.js"

const props = defineProps<{ __node: ElementNode; href?: string }>()
const href = computed(() => props.href ?? "")
// 外部：流式中未写完的链接 href 是 comark:incomplete-link
const external = computed(() => /^https?:\/\//i.test(href.value))
const fileOpener = inject(openFileKey, undefined)
const isFile = computed(() => Boolean(fileOpener?.accepts(href.value)))
const text = computed(() => textContent(props.__node))
const label = computed(() => linkChipLabel(href.value, text.value))
</script>
