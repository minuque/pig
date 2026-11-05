<template>
  <div class="tool-command-body">
    <div v-if="commandLines.length" class="command-block">
      <CopyButton v-if="command" :text="command" />

      <div v-for="(line, index) in commandLines" :key="index" class="command-row">
        <span class="prompt" aria-hidden="true">{{ index === 0 ? "$" : "" }}</span>
        <code v-if="tokens[index]" v-token-line="tokens[index]" class="command" />
        <code v-else class="command">{{ line }}</code>
      </div>
    </div>

    <ToolOutput :text="output" :images="call.outputImages" soft-wrap />
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import CopyButton from "@features/transcript-view/components/CopyButton.vue"
import ToolOutput from "@features/transcript-view/components/ToolOutput.vue"
import {
  highlightCodeTokens,
  type CodeTokens,
  vTokenLine,
} from "@features/transcript-view/lib/markdown-render-props.js"
import { splitCommandStatus, toolCommand } from "@features/transcript-view/lib/transcript-format.js"
import { useColorScheme } from "@features/theme/index.js"
import type { ToolCallView } from "@features/transcript-view/type.js"

const props = defineProps<{
  call: ToolCallView
}>()
const { codeBlockProps } = useColorScheme()
const command = computed(() => toolCommand(props.call.input))
const commandLines = computed(() => (command.value ? command.value.split("\n") : []))
const output = computed(() => {
  const status = props.call.isError ? "error" : props.call.running ? "running" : "success"
  return splitCommandStatus(props.call.outputText, status).body.trimEnd()
})
const tokens = shallowRef<CodeTokens>([])

watch(
  [command, () => codeBlockProps.value.theme],
  async ([text, theme], _, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })

    if (!text) {
      tokens.value = []
      return
    }

    try {
      const next = await highlightCodeTokens(text, "bash", theme)

      if (active) tokens.value = next
    } catch {
      if (active) tokens.value = []
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.tool-command-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
}

.command-block {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: var(--space-xs) var(--space-sm);
  padding-inline-end: calc(var(--space-sm) + 22px);
  border-radius: var(--radius-md);
  background: var(--code-background);
  box-shadow: inset 0 0 0 var(--border-width) var(--border-subtle);
  color: var(--code-foreground);
  font-family: var(--font-mono);
  font-size: var(--text-code);
  line-height: var(--text-code-line);
}

.command-row {
  display: flex;
  gap: var(--space-xs);
  min-width: 0;
}

.prompt {
  flex: none;
  width: 1ch;
  color: var(--contrast-foreground-faint);
}

.command {
  min-width: 0;
  color: inherit;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
