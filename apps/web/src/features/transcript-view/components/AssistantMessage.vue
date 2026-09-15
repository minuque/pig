<template>
  <article>
    <MarkdownRender
      v-if="showHeavy && item.text"
      :key="item.id"
      v-bind="agentMarkdown"
      :content="item.text"
    />

    <div v-else-if="item.text" class="md-plain">{{ item.text }}</div>

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
import { chatMarkdownProps } from "@features/transcript-view/lib/markdown-render-props.js"

const props = withDefaults(
  defineProps<{
    item: AssistantRow
    streaming?: boolean
    hydrated?: boolean
  }>(),
  { streaming: false, hydrated: false },
)

const { isDark } = useColorScheme()

const showHeavy = computed(() => props.streaming || props.hydrated)

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
  }),
)
</script>

<style scoped>
.md-plain {
  color: var(--ink-markdown);
  font-size: var(--text-body-md);
  line-height: 1.8;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.status-alert {
  margin-top: var(--spacing-xs);
}

.status-alert:first-child {
  margin-top: 0;
}

.message-stamp {
  margin-top: var(--spacing-xs);
}
</style>
