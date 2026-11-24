<template>
  <Tooltip>
    <TooltipTrigger>
      <template #render="{ props: part }">
        <Link
          v-bind="part"
          class="link-chip"
          :href="url"
          target="_blank"
          rel="noopener noreferrer"
          weight="medium"
          underline="hover"
          underline-style="dotted"
        >
          <VendorMark v-if="site" class="icon" :vendor="site" :size="14" />
          <LinkIcon v-else class="icon" />
          <span class="label">{{ text }}</span>
        </Link>
      </template>
    </TooltipTrigger>

    <TooltipContent>{{ url }}</TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { LinkIcon } from "@components/icons/index.js"
import VendorMark from "@components/icons/VendorMark.vue"
import { Link } from "@pig/ui/link"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import { linkSite, shortUrlLabel } from "@features/transcript-view/lib/link-chip.js"

const props = defineProps<{
  url: string
  label?: string
}>()
const text = computed(() => props.label ?? shortUrlLabel(props.url))
const site = computed(() => linkSite(props.url))
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
