<template>
  <TranscriptLinkChip v-if="external" :url="href" :label="label" />
  <Link v-else-if="href.startsWith('#')" :href="href" underline="hover"><slot /></Link>

  <Link
    v-else-if="fileOpener?.accepts(href)"
    href="#"
    class="file-link"
    color="cyan"
    weight="medium"
    underline="hover"
    :title="href"
    @click.prevent="fileOpener.open({ path: href })"
  >
    <LanguageIcon class="file-link-icon" :language="extension" aria-hidden="true" />
    <slot />
  </Link>

  <span v-else><slot /></span>
</template>

<script setup lang="ts">
import { computed, inject } from "vue"
import type { ElementNode } from "comark"
import { textContent } from "comark/utils"
import LanguageIcon from "@components/icons/LanguageIcon.vue"
import { Link } from "@components/ui/link/index.js"
import TranscriptLinkChip from "@features/transcript-view/components/TranscriptLinkChip.vue"
import { linkChipLabel } from "@features/transcript-view/lib/link-chip.js"
import { openFileKey } from "@features/transcript-view/index.js"

const props = defineProps<{ __node: ElementNode; href?: string }>()
const href = computed(() => props.href ?? "")
// 外部：流式中未写完的链接 href 是 comark:incomplete-link
const external = computed(() => /^https?:\/\//i.test(href.value))
const fileOpener = inject(openFileKey, undefined)
const label = computed(() => linkChipLabel(href.value, textContent(props.__node)))
const extension = computed(() => {
  const name = href.value.split(/[?#]/)[0]?.split("/").pop() ?? ""
  return name.includes(".")
    ? (name
        .split(".")
        .pop()
        ?.replace(/:\d+.*$/, "") ?? "text")
    : "text"
})
</script>

<style scoped>
.file-link {
  display: inline-block;
  max-width: 100%;
  overflow-x: clip;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.file-link .file-link-icon {
  width: 1em;
  height: 1em;
  margin-inline-end: 0.2em;
  vertical-align: -0.125em;
}
</style>
