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
        underline-style="dotted"
      >
        <LinkIcon class="icon" />
        <span class="label">{{ text }}</span>
      </Link>
    </TooltipTrigger>

    <TooltipContent>{{ url }}</TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { LinkIcon } from "@components/icons/index.js"
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
.link-chip {
  color: var(--link-external);
  display: inline-flex;
  align-items: baseline;
  max-width: 100%;
  margin-inline: 0.15em;
  line-height: inherit;
  vertical-align: baseline;
}

.icon {
  flex: none;
  align-self: center;
  width: 1em;
  height: 1em;
  margin-inline-end: 0.2em;
}

.label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
