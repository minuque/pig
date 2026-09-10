<template>
  <article>
    <MarkdownRender v-if="text && rich" v-bind="agentMarkdown" :content="text" />
    <p v-else-if="text" class="plain">{{ text }}</p>

    <Alert
      v-if="item.error || item.aborted"
      class="status-alert"
      :variant="item.error ? 'error' : 'warning'"
    >
      <CircleAlert />
      <AlertTitle>{{ statusLabel }}</AlertTitle>
      <AlertDescription v-if="item.errorMessage">{{ item.errorMessage }}</AlertDescription>
    </Alert>
    <MessageTimestamp
      v-if="item.showTimestamp"
      class="message-stamp"
      :timestamp="item.timestamp"
      :text="item.text"
    />
  </article>
</template>

<script setup lang="ts">
import { CircleAlert } from "@lucide/vue"
import MarkdownRender from "markstream-vue"
import { computed } from "vue"
import Alert from "@components/ui/alert/Alert.vue"
import AlertDescription from "@components/ui/alert/AlertDescription.vue"
import AlertTitle from "@components/ui/alert/AlertTitle.vue"
import MessageTimestamp from "@features/transcript-view/components/MessageTimestamp.vue"
import type { AssistantRow } from "@features/transcript-view/type.js"
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js"
import { useDeferredMarkdown } from "@features/transcript-view/hooks/use-deferred-markdown.js"
import { useTranscriptReveal } from "@features/transcript-view/hooks/use-transcript-reveal.js"
import { chatMarkdownProps } from "@features/transcript-view/lib/markdown-render-props.js"

const props = withDefaults(
  defineProps<{
    item: AssistantRow
    streaming?: boolean
  }>(),
  { streaming: false },
)

const { isDark, codeBlockProps } = useColorScheme()
const rich = useDeferredMarkdown(() => props.streaming)
const text = useTranscriptReveal(
  () => props.item.text,
  () => props.streaming,
)

const statusLabel = computed(() => {
  const base = props.item.error ? "出错" : "已中止"
  const retries = props.item.retryCount
  if (retries && retries > 1) return `${base} · ${retries} 次`
  return base
})

const agentMarkdown = computed(() =>
  chatMarkdownProps({
    streaming: props.streaming,
    isDark: isDark.value,
    codeBlockProps: codeBlockProps.value,
  }),
)
</script>

<style scoped>
.status-alert {
  margin-top: var(--spacing-xs);
}
.status-alert:first-child {
  margin-top: 0;
}

.plain {
  margin: 0;
  color: var(--ink-markdown);
  font-size: var(--text-body-md);
  line-height: var(--text-body-md--line-height);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.message-stamp {
  margin-top: var(--spacing-xs);
}
</style>
