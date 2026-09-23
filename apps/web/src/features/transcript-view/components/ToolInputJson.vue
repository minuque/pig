<template>
  <div class="input-json">
    <div v-for="(line, lineIndex) in lines" :key="lineIndex" class="json-line">
      <span v-for="(token, tokenIndex) in line" :key="tokenIndex" :style="{ color: token.color }">
        {{ token.content }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { useColorScheme } from "@features/theme/index.js"
import { highlightCodeTokens } from "@features/transcript-view/lib/markdown-render-props.js"

type JsonToken = { content: string; color?: string }

const props = defineProps<{ text: string }>()
const { codeBlockProps } = useColorScheme()
const tokens = shallowRef<JsonToken[][]>([])
const formatted = computed(() => {
  try {
    return JSON.stringify(JSON.parse(props.text), null, 2)
  } catch {
    return props.text
  }
})
const lines = computed((): JsonToken[][] => {
  if (tokens.value.length) return tokens.value
  return formatted.value.split(/\r?\n/).map((line) => [{ content: line }])
})

watch(
  () => [formatted.value, codeBlockProps.value.theme] as const,
  async ([text, theme], _, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })

    if (!text || text.length > 100_000) {
      tokens.value = []
      return
    }

    try {
      const next = await highlightCodeTokens(text, "json", theme)

      if (active) tokens.value = next
    } catch {
      if (active) tokens.value = []
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.input-json {
  min-width: 0;
  color: var(--ink);
  font-family: var(--font-mono);
  line-height: var(--text-caption--line-height);
  overflow-wrap: anywhere;
  tab-size: 2;
}

.json-line {
  min-height: 1lh;
}
</style>
