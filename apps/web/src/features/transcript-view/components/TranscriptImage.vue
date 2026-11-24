<template>
  <Card size="s" variant="surface" class="thumb">
    <template #render="{ props: part }">
      <button v-bind="part" type="button" @click="open = true">
        <img :src="src" :alt="altText" class="thumb-img" />
      </button>
    </template>
  </Card>

  <PreviewDialog v-model:open="open" :src="src" :title="altText" />
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "@i18n/index.js"
import { Card } from "@pig/ui/card"
import PreviewDialog from "@features/preview/index.vue"
import { transcriptImageSrc } from "@features/transcript-view/lib/transcript-format.js"

const { t } = useI18n()
const props = withDefaults(
  defineProps<{
    data: string
    mimeType: string
    alt?: string
  }>(),
  { alt: "" },
)
const open = ref(false)
const altText = computed(() => props.alt || t("transcript.image"))
const src = computed(() => transcriptImageSrc(props.data, props.mimeType))
</script>

<style scoped>
.thumb[data-slot="card"] {
  --card-padding: 0;
  --card-background-color: var(--bg);

  width: 30%;
  border: 0;
  cursor: zoom-in;
}

.thumb-img {
  display: block;
  width: 100%;
  height: auto;
}
</style>
