<template>
  <article ref="rootEl">
    <MarkdownRender
      v-if="showHeavy && item.text"
      :key="item.id"
      v-bind="agentMarkdown"
      :content="item.text"
    />
    <div v-else-if="item.text" class="md-pending" aria-hidden="true"></div>

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
import { computed, inject, onBeforeUnmount, onMounted, shallowRef, watch } from "vue"
import Alert from "@components/ui/alert/Alert.vue"
import AlertDescription from "@components/ui/alert/AlertDescription.vue"
import AlertTitle from "@components/ui/alert/AlertTitle.vue"
import MessageTimestamp from "@features/transcript-view/components/MessageTimestamp.vue"
import { transcriptScrollIdleKey } from "@features/transcript-view/hooks/use-transcript-scroll-idle.js"
import type { AssistantRow } from "@features/transcript-view/type.js"
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js"
import { chatMarkdownProps } from "@features/transcript-view/lib/markdown-render-props.js"
import { shouldHydrateHeavy } from "@features/transcript-view/lib/transcript-hydrate.js"

const props = withDefaults(
  defineProps<{
    item: AssistantRow
    streaming?: boolean
  }>(),
  { streaming: false },
)

const { isDark, codeBlockProps } = useColorScheme()
const scrollIdle = inject(transcriptScrollIdleKey, shallowRef(true))
const inView = shallowRef(false)
const hydrated = shallowRef(false)
const rootEl = shallowRef<HTMLElement | null>(null)
const showHeavy = computed(() => props.streaming || hydrated.value)

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

let viewObserver: IntersectionObserver | undefined

function stopViewWatch() {
  viewObserver?.disconnect()
  viewObserver = undefined
}

function tryHydrate() {
  if (hydrated.value) return
  if (!shouldHydrateHeavy(props.streaming, inView.value, scrollIdle.value)) return
  hydrated.value = true
  stopViewWatch()
}

watch([() => props.streaming, inView, scrollIdle], tryHydrate, { flush: "sync" })

onMounted(() => {
  tryHydrate()
  if (hydrated.value) return
  const target = rootEl.value
  if (!target) return
  viewObserver = new IntersectionObserver(
    (entries) => {
      inView.value = entries.some((entry) => entry.isIntersecting)
    },
    { root: target.closest("#transcript-panel"), threshold: 0 },
  )
  viewObserver.observe(target)
})

onBeforeUnmount(stopViewWatch)
</script>

<style scoped>
.md-pending {
  min-height: calc(var(--spacing-lg) * 6);
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
