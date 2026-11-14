<template>
  <TranscriptLinkChip v-if="external" :url="href" :label="label" />
  <Link v-else-if="href.startsWith('#')" :href="href" underline="hover"><slot /></Link>

  <Link
    v-else-if="fileOpener?.accepts(href)"
    href="#"
    underline="hover"
    :title="href"
    @click.prevent="fileOpener.open({ path: href })"
  >
    <slot />
  </Link>

  <span v-else><slot /></span>
</template>

<script setup lang="ts">
import { computed, inject } from "vue"
import type { ElementNode } from "comark"
import { textContent } from "comark/utils"
import { Link } from "@components/ui/link/index.js"
import TranscriptLinkChip from "@features/transcript-view/components/TranscriptLinkChip.vue"
import { linkChipLabel } from "@features/transcript-view/lib/link-chip.js"
import { openFileKey } from "@features/transcript-view/index.js"

const props = defineProps<{ __node: ElementNode; href?: string }>()
const href = computed(() => props.href ?? "")
// 流式中未写完的链接 href 是 comark:incomplete-link，按普通文字显示。
const external = computed(() => /^https?:\/\//i.test(href.value))
const fileOpener = inject(openFileKey, undefined)
const label = computed(() => linkChipLabel(href.value, textContent(props.__node)))
</script>
