<template>
  <TranscriptLinkChip v-if="external" :url="node.href" :label="label" />

  <Link v-else-if="node.href.startsWith('#')" :href="node.href" underline="hover">
    {{ node.text }}
  </Link>

  <span v-else>{{ node.text }}</span>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Link } from "@components/ui/link/index.js"
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
