<template>
  <article class="user">
    <div v-if="item.text" class="prompt">
      <div ref="body" class="body" :class="{ collapsed: !expanded, fade: !expanded && overflows }">
        <template v-for="(part, index) in parts" :key="index">
          <span v-if="part.kind === 'text'">{{ part.text }}</span>
          <TranscriptLinkChip v-else :url="part.text" />
        </template>
      </div>

      <button
        v-if="overflows || expanded"
        type="button"
        class="toggle"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? "收起" : "展开" }}
      </button>
    </div>

    <div v-if="item.images.length" class="images">
      <TranscriptImage
        v-for="(image, index) in item.images"
        :key="index"
        :data="image.data"
        :mime-type="image.mimeType"
      />
    </div>

    <MessageTimestamp copy-before :timestamp="item.timestamp" :text="item.text" />
  </article>
</template>

<script setup lang="ts">
import { useResizeObserver } from "@vueuse/core"
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from "vue"
import MessageTimestamp from "@features/transcript-view/components/MessageTimestamp.vue"
import TranscriptImage from "@features/transcript-view/components/TranscriptImage.vue"
import TranscriptLinkChip from "@features/transcript-view/components/TranscriptLinkChip.vue"
import { splitLinkText } from "@features/transcript-view/lib/link-chip.js"
import type { UserRow } from "@features/transcript-view/type.js"

const COLLAPSED_LINES = 12
const props = defineProps<{
  item: UserRow
}>()
const body = useTemplateRef("body")
const expanded = ref(false)
const overflows = ref(likelyOverflows(props.item.text))
const parts = computed(() => splitLinkText(props.item.text))

function likelyOverflows(text: string): boolean {
  let newlines = 0

  for (let index = text.indexOf("\n"); index !== -1; index = text.indexOf("\n", index + 1)) {
    newlines += 1

    if (newlines >= COLLAPSED_LINES) return true
  }

  return text.length > 600
}

function measure(): void {
  const el = body.value

  if (!el || expanded.value) return
  overflows.value = el.scrollHeight - el.clientHeight > 1
}

watch(
  () => props.item.text,
  async () => {
    expanded.value = false
    overflows.value = likelyOverflows(props.item.text)
    await nextTick()
    measure()
  },
)

watch(expanded, async (open) => {
  if (open) return
  await nextTick()
  measure()
})

onMounted(measure)

useResizeObserver(body, measure)
</script>

<style scoped>
.user {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-xs);
}

.prompt {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: fit-content;
  max-width: min(calc(var(--size-content) * 0.702), 86%);
  margin: 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-xl);
  background: var(--user-prompt-bg);
  color: var(--ink);
  font-size: var(--text-body-md);
  line-height: 1.5;
}

.body {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.body.collapsed {
  max-height: calc(1.5em * 12);
  overflow: hidden;
}

.body.fade {
  mask-image: linear-gradient(to bottom, black calc(100% - 3em), transparent);
}

.toggle {
  margin: var(--spacing-xxs) 0 0;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ink-muted);
  font: inherit;
  font-size: var(--text-caption);
  line-height: 1.4;
  cursor: pointer;
}

.toggle:hover {
  color: var(--ink);
}

.images {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-xs);
  max-width: 100%;
}
</style>
