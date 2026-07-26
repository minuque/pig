<script setup lang="ts">
import { computed } from "vue";
import { markdownToVNodes } from "@/features/transcript/markdown";
import { VNodeSlot } from "@/components/VNodeSlot";

/**
 * Safe Markdown renderer: tokens become Vue VNodes (no v-html, no
 * innerHTML), raw HTML is inert text, and links pass a protocol whitelist.
 */
const props = defineProps<{ source: string }>();
const nodes = computed(() => markdownToVNodes(props.source));
</script>

<template>
  <div class="markdown-view">
    <VNodeSlot :nodes="nodes" />
  </div>
</template>
