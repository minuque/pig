<template>
  <div class="tool-command-body">
    <CodeCard v-if="commandLines.length" class="command-block">
      <CopyButton v-if="command" :text="command" />

      <div class="command-scroll">
        <div v-for="(line, index) in commandLines" :key="index" class="command-row">
          <span class="prompt" aria-hidden="true">{{ index === 0 ? "$" : "" }}</span>
          <code v-if="tokens[index]" v-token-line="tokens[index]" class="command" />
          <code v-else class="command">{{ line }}</code>
        </div>
      </div>
    </CodeCard>

    <ToolOutput :text="output" :images="call.outputImages" soft-wrap />

    <p v-if="statusLine" class="command-status" :class="{ 'is-error': call.isError }">
      {{ statusLine }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import CodeCard from "@features/transcript-view/components/CodeCard.vue"
import CopyButton from "@features/transcript-view/components/CopyButton.vue"
import ToolOutput from "@features/transcript-view/components/ToolOutput.vue"
import {
  highlightCodeTokens,
  type CodeTokens,
  vTokenLine,
} from "@features/transcript-view/lib/code-highlight.js"
import { splitCommandStatus, toolCommand } from "@features/transcript-view/lib/transcript-format.js"
import { useColorScheme } from "@features/theme/index.js"
import type { ToolCallView } from "@features/transcript-view/type.js"

const props = defineProps<{
  call: ToolCallView
}>()
const { t } = useI18n()
const { codeBlockProps } = useColorScheme()
const command = computed(() => toolCommand(props.call.input))
const commandLines = computed(() => (command.value ? command.value.split("\n") : []))
const result = computed(() => {
  const status = props.call.isError ? "error" : props.call.running ? "running" : "success"
  return splitCommandStatus(props.call.outputText, status)
})
const output = computed(() => result.value.body.trimEnd())
const statusLine = computed(() => {
  const { exitCode, statusLine } = result.value

  if (exitCode === undefined) return statusLine
  return exitCode === 0 ? "" : t("transcript.exitCode", { code: exitCode })
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

/* 输入保留底色，和下方只描边的输出区分开 */
.command-block {
  --card-background-color: var(--surface);

  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: var(--space-xs) 0 var(--space-xs) var(--space-sm);
  font-family: var(--font-mono);
  font-size: var(--text-code);
  line-height: var(--text-code-line);
}

/* 长命令只滚命令区，复制按钮留在卡片角上 */
.command-scroll {
  display: flex;
  flex-direction: column;
  min-width: 0;
  /* 滚动条贴卡片右缘：右内边距放在滚动区里，只给内容让出复制按钮的位置 */
  padding-inline-end: calc(var(--space-sm) + 22px);
  max-height: var(--transcript-tool-max);
  overflow: auto;
  /* 卡片底比全局滚动条色深，滚动条会看不出，这里提到 ink 12% */
  --scrollbar-thumb: var(--fill-strong);
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

.command-status {
  margin: 0;
  padding-inline-start: var(--space-sm);
  color: var(--contrast-foreground-faint);
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  line-height: 1.43;
}

.command-status.is-error {
  color: var(--danger);
}
</style>
