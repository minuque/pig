<template>
  <pre class="input-json" :title="text">
    <template v-if="tokens.length">
      <template v-for="(line, lineIndex) in tokens" :key="lineIndex">
        <span
          v-for="(token, tokenIndex) in line"
          :key="tokenIndex"
          :style="{ color: token.color }"
          >{{ token.content }}</span
        >

          <template v-if="lineIndex < tokens.length - 1">{{ "\n" }}</template>
      </template>
    </template>

    <template v-else>{{ text }}</template>
  </pre>
</template>

<script setup lang="ts">
import { shallowRef, watch } from "vue"
import { useColorScheme } from "@features/theme/index.js"
import { highlightCodeTokens } from "@features/transcript-view/lib/markdown-render-props.js"

const props = defineProps<{ text: string }>()
const { codeBlockProps } = useColorScheme()
const tokens = shallowRef<{ content: string; color?: string }[][]>([])

watch(
  () => [props.text, codeBlockProps.value.theme] as const,
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
  margin: 0;
  color: var(--ink);
  font-family: var(--font-mono);
  line-height: var(--text-caption--line-height);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
