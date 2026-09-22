<template>
  <a class="link-chip" :href="url" :title="url" target="_blank" rel="noopener noreferrer">
    <svg v-if="chip.isGitHub" class="icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.7 7.7 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>

    <img
      v-else-if="shownSrc"
      class="icon favicon"
      :src="shownSrc"
      alt=""
      referrerpolicy="no-referrer"
      @error="onIconError"
    />

    <Link v-else class="icon" aria-hidden="true" />
    <span class="label">{{ text }}</span>
  </a>
</template>

<script setup lang="ts">
import { Link } from "@lucide/vue"
import { computed, ref, watch } from "vue"
import { describeLinkChip } from "@features/transcript-view/lib/link-chip.js"
import {
  markSiteFaviconFailed,
  probeSiteFavicon,
  siteFaviconSrc,
} from "@features/transcript-view/lib/site-favicon.js"

const props = defineProps<{
  url: string
  label?: string
}>()
const chip = computed(() => describeLinkChip(props.url))
const text = computed(() => props.label ?? chip.value.label)
const src = computed(() => (chip.value.isGitHub ? null : siteFaviconSrc(props.url)))
const shownSrc = ref<string | null>(null)

watch(
  src,
  (value) => {
    shownSrc.value = null

    if (!value) return
    const current = value

    void probeSiteFavicon(current).then((status) => {
      if (src.value !== current) return
      shownSrc.value = status === "ok" ? current : null
    })
  },
  { immediate: true },
)

function onIconError(): void {
  if (src.value) markSiteFaviconFailed(src.value)
  shownSrc.value = null
}
</script>

<style scoped>
.link-chip {
  display: inline-flex;
  /* 标签文字按基线对齐，图标单独居中，整行高度不变 */
  align-items: baseline;
  max-width: 100%;
  margin-inline: 0.15em;
  color: var(--link);
  font-weight: var(--font-weight-medium);
  line-height: inherit;
  text-decoration: none;
  vertical-align: baseline;
}

.link-chip:hover {
  text-decoration: underline;
  text-underline-offset: 0.18em;
}

.icon {
  /* svg 没有基线，底边贴基线会整体偏高，改成随文字居中 */
  align-self: center;
  width: 1em;
  height: 1em;
  flex: none;
  margin-right: 0.28em;
}

.favicon {
  object-fit: contain;
  border-radius: 2px;
}

.label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
