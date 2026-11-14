<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Link
        class="link-chip"
        :href="url"
        target="_blank"
        rel="noopener noreferrer"
        weight="medium"
        underline="hover"
      >
        <span class="label">{{ text }}</span>
      </Link>
    </TooltipTrigger>

    <TooltipContent>{{ url }}</TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Link } from "@components/ui/link/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { prettifyUrl } from "@features/transcript-view/lib/link-chip.js"

const props = defineProps<{
  url: string
  label?: string
}>()
const text = computed(() => props.label ?? prettifyUrl(props.url))
</script>

<style scoped>
/* 外链不带图标，悬停出下划线；inline-flex 让长地址能截断又不改行高 */
.link-chip {
  display: inline-flex;
  align-items: baseline;
  max-width: 100%;
  margin-inline: 0.15em;
  line-height: inherit;
  vertical-align: baseline;
}

.label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
