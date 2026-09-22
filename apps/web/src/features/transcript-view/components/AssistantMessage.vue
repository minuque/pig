<template>
  <article>
    <MarkdownRender
      v-if="item.text"
      :key="item.id"
      v-bind="agentMarkdown"
      :content="item.text"
      @virtual-state-change="onVirtualStateChange"
    />

    <div v-else-if="streaming" class="md-pending" aria-hidden="true"></div>

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

<script lang="ts">
import type { MarkstreamVirtualState } from "markstream-vue"

const SESSION_SCOPE_MAX = 4
const ROW_STATE_LIMIT = 30
const scopes = new Map<string, Map<string, MarkstreamVirtualState>>()

function scopeStates(scope: string): Map<string, MarkstreamVirtualState> {
  const hit = scopes.get(scope)

  if (hit) {
    scopes.delete(scope)
    scopes.set(scope, hit)
    return hit
  }

  const created = new Map<string, MarkstreamVirtualState>()

  scopes.set(scope, created)

  while (scopes.size > SESSION_SCOPE_MAX) {
    const oldest = scopes.keys().next().value

    if (oldest === undefined || oldest === scope) break
    scopes.delete(oldest)
  }

  return created
}

/** 行重挂后恢复库内部虚拟状态，按会话 scope 分开存，最多留 4 个会话。 */
export function saveMarkdownVirtualState(
  scope: string,
  rowId: string,
  state: MarkstreamVirtualState,
): void {
  const states = scopeStates(scope)

  states.delete(rowId)
  states.set(rowId, state)

  while (states.size > ROW_STATE_LIMIT) {
    const oldest = states.keys().next().value

    if (oldest === undefined || oldest === rowId) break
    states.delete(oldest)
  }
}

/** 取出缓存的虚拟状态；没有则返回 null 让库按新内容估算。 */
export function takeMarkdownVirtualState(
  scope: string,
  rowId: string,
): MarkstreamVirtualState | null {
  const states = scopeStates(scope)
  const hit = states.get(rowId)

  if (!hit) return null
  states.delete(rowId)
  states.set(rowId, hit)
  return hit
}
</script>

<script setup lang="ts">
import { CircleAlert } from "@lucide/vue"
import MarkdownRender from "markstream-vue"
import { computed } from "vue"
import Alert from "@components/ui/alert/Alert.vue"
import AlertDescription from "@components/ui/alert/AlertDescription.vue"
import AlertTitle from "@components/ui/alert/AlertTitle.vue"
import MessageTimestamp from "@features/transcript-view/components/MessageTimestamp.vue"
import type { AssistantRow } from "@features/transcript-view/type.js"
import { useColorScheme } from "@features/theme/index.js"
import { chatMarkdownProps } from "@features/transcript-view/lib/markdown-render-props.js"

const props = withDefaults(
  defineProps<{
    item: AssistantRow
    streaming?: boolean
    sessionId?: string
  }>(),
  { streaming: false, sessionId: "" },
)
const { isDark } = useColorScheme()
const markdownKey = computed(() =>
  props.sessionId ? `${props.sessionId}/${props.item.id}` : props.item.id,
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
    sessionKey: markdownKey.value,
    restoreState: takeMarkdownVirtualState(props.sessionId, props.item.id),
  }),
)

function onVirtualStateChange(state: MarkstreamVirtualState) {
  if (props.streaming) return
  saveMarkdownVirtualState(props.sessionId, props.item.id, state)
}
</script>

<style scoped>
.md-pending {
  min-height: calc(var(--text-body-md) * 1.625);
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
