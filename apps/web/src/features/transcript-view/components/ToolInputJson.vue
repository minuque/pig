<template>
  <div class="input-json">
    <template v-if="tokens.length">
      <div
        v-for="(line, lineIndex) in tokens"
        :key="lineIndex"
        v-token-line="line"
        class="json-line"
      />
    </template>

    <template v-else>
      <div v-for="(line, lineIndex) in plainLines" :key="lineIndex" class="json-line">
        {{ line }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { useColorScheme } from "@features/theme/index.js"
import {
  highlightCodeTokens,
  type CodeTokens,
  vTokenLine,
} from "@features/transcript-view/lib/markdown-render-props.js"

const props = defineProps<{ text: string }>()
const { codeBlockProps } = useColorScheme()
const tokens = shallowRef<CodeTokens>([])
const formatted = computed(() => {
  try {
    return JSON.stringify(JSON.parse(props.text), null, 2)
  } catch {
    return props.text
  }
})
const plainLines = computed(() => formatted.value.split(/\r?\n/))

watch(
  [formatted, () => codeBlockProps.value.theme],
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
