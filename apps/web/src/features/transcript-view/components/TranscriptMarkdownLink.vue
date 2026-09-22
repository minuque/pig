<template>
  <TranscriptLinkChip v-if="external" :url="node.href" :label="label" />
  <a v-else class="plain" :href="node.href">{{ node.text }}</a>
</template>

<script setup lang="ts">
import { computed } from "vue"
import TranscriptLinkChip from "@features/transcript-view/components/TranscriptLinkChip.vue"
import { linkChipLabel } from "@features/transcript-view/lib/link-chip.js"

const props = defineProps<{
  node: {
    href: string
    text: string
    title?: string | null
  }
}>()
const external = computed(() => /^https?:\/\//i.test(props.node.href))
const label = computed(() => linkChipLabel(props.node.href, props.node.text))
</script>

<style scoped>
.plain {
  color: var(--link);
  text-decoration: none;
}

.plain:hover {
  text-decoration: underline;
  text-underline-offset: 0.18em;
}
</style>
