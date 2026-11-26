<template>
  <span
    class="view-island"
    data-island
    :data-expanded="expanded || undefined"
    @pointerenter="hovered = true"
    @pointerleave="hovered = false"
  >
    <TabsRoot :model-value="current" @update:model-value="show">
      <TabsList variant="segmented" size="s" :aria-label="t('views.label')">
        <span v-if="runningLabel" class="island-running">
          <StatusIndicator status="running" size="s" pulse />
          {{ runningLabel }}
        </span>

        <TabsTrigger
          v-for="view in PANE_VIEWS"
          :key="view"
          :value="view"
          class="island-tab"
          :data-current="view === current || undefined"
        >
          {{ t(`views.${view}`) }}
        </TabsTrigger>

        <span class="island-position" aria-hidden="true">
          {{
            t("views.position", {
              index: PANE_VIEWS.indexOf(current) + 1,
              total: PANE_VIEWS.length,
            })
          }}
        </span>
      </TabsList>
    </TabsRoot>

    <Transition name="island-alert">
      <div v-if="waiting" key="waiting" class="island-alert" role="status">
        <StatusIndicator status="waiting" size="s" pulse />

        <span class="island-alert-text">
          <span class="island-alert-title">{{ waiting.header }}</span>
          <span class="island-alert-body">{{ waiting.message || waiting.question }}</span>
        </span>

        <template v-if="confirming">
          <Button size="s" variant="secondary" @click="board.pick(0)">
            {{ t("extensionUi.deny") }}
          </Button>

          <Button size="s" @click="board.pick(1)">{{ t("extensionUi.allow") }}</Button>
        </template>

        <Button v-else size="s" variant="secondary" @click="backToChat">
          {{ t("extensionUi.answer") }}
        </Button>
      </div>

      <div
        v-else-if="alert"
        :key="alertSeq"
        class="island-alert"
        role="status"
        @pointerenter="holdAlert(true)"
        @pointerleave="holdAlert(false)"
      >
        <StatusIndicator :status="alert.tone === 'info' ? 'running' : alert.tone" size="s" />

        <span class="island-alert-text">
          <span class="island-alert-title">{{ alert.title }}</span>
          <span v-if="alert.body" class="island-alert-body">{{ alert.body }}</span>
        </span>

        <span v-if="more" class="island-alert-more">{{ t("views.more", { count: more }) }}</span>

        <Button v-if="current !== 'chat'" size="s" variant="secondary" @click="backToChat">
          {{ t("views.backToChat") }}
        </Button>
      </div>
    </Transition>
  </span>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from "vue"
import { useIntervalFn } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { Button } from "@pig/ui/button"
import { StatusIndicator } from "@pig/ui/status-indicator"
import { TabsList, TabsRoot, TabsTrigger } from "@pig/ui/tabs"
import { useSession } from "@features/session/index.js"
import { useExtensionUi } from "@features/extension-ui/index.js"
import { useQuestionBoard } from "@features/extension-ui/hooks/use-question-board.js"
import {
  ALERT_TTL,
  PANE_VIEWS,
  usePaneSide,
  useSplitView,
  type PaneView,
} from "@features/split-view/index.js"
import { formatElapsed } from "@utils/time.js"

const PEEK_MS = 1200
const { t } = useI18n()
const side = usePaneSide()
const split = useSplitView()
const current = computed(() => split.view(side))
const hovered = shallowRef(false)
const peeking = shallowRef(false)
const expanded = computed(() => hovered.value || peeking.value)
let timer: ReturnType<typeof setTimeout> | undefined

watch(current, () => {
  clearTimeout(timer)
  peeking.value = true
  timer = setTimeout(() => (peeking.value = false), PEEK_MS)
})

const { turnPending } = useSession()
const now = shallowRef(Date.now())
const since = shallowRef<number>()
const tick = useIntervalFn(() => (now.value = Date.now()), 1000, { immediate: false })
const runningLabel = computed(() =>
  since.value === undefined ? "" : formatElapsed(now.value - since.value, { showMs: false }),
)

watch(
  turnPending,
  (busy) => {
    now.value = Date.now()
    since.value = busy ? now.value : undefined

    if (busy) tick.resume()
    else tick.pause()
  },
  { immediate: true },
)

const board = useQuestionBoard()
const { dialogs } = useExtensionUi()
const { sessionId } = useSession()
const waiting = computed(() => (current.value === "chat" ? undefined : board.question.value))
const confirming = computed(
  () =>
    board.board.value?.source === "extension" &&
    dialogs.value.some(
      (item) =>
        item.sessionId === sessionId.value &&
        item.request.id === board.board.value?.id &&
        item.request.method === "confirm",
    ),
)
const alert = computed(() => split.alerts.current(side))
const more = computed(() => split.alerts.pending(side))
const alertSeq = shallowRef(0)
let alertTimer: ReturnType<typeof setTimeout> | undefined

function armAlert() {
  clearTimeout(alertTimer)
  const next = alert.value

  if (next) alertTimer = setTimeout(() => split.alerts.dismiss(side), ALERT_TTL[next.kind])
}

function holdAlert(held: boolean) {
  if (held) clearTimeout(alertTimer)
  else armAlert()
}

watch(alert, () => {
  alertSeq.value += 1
  armAlert()
})

watch(current, (view) => {
  if (view === "chat") split.alerts.clear(side)
})

function backToChat() {
  split.showView(side, "chat")
}

onBeforeUnmount(() => {
  clearTimeout(timer)
  clearTimeout(alertTimer)
})

function show(view: string) {
  const next = PANE_VIEWS.find((item) => item === view)

  if (next) split.showView(side, next satisfies PaneView)
}
</script>

<style scoped>
.view-island {
  position: relative;
  display: inline-flex;
  justify-self: center;
}

.island-running {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  padding-inline: var(--space-xs) var(--space-2xs);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.island-alert {
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 50%;
  z-index: var(--z-overlay);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-inline-size: 280px;
  max-inline-size: min(420px, 80vw);
  padding: var(--space-xs) var(--space-xs) var(--space-xs) var(--space-sm);
  translate: -50% 0;
  border-radius: var(--radius-card);
  corner-shape: round;
  background-color: var(--float-bg);
  box-shadow: var(--float-shadow);
  backdrop-filter: var(--glass-filter);
}

.island-alert-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-inline-size: 0;
}

.island-alert-title {
  overflow: hidden;
  color: var(--fg);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.island-alert-body {
  overflow: hidden;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.island-alert-more {
  flex-shrink: 0;
  color: var(--fg-muted);
  font-size: var(--text-meta);
}

.island-alert-enter-active,
.island-alert-leave-active {
  transition:
    opacity var(--duration-normal) var(--ease-out),
    scale var(--duration-normal) var(--ease-spring);
}

.island-alert-enter-from,
.island-alert-leave-to {
  opacity: 0;
  scale: 0.9;
}

.island-tab:not([data-current]) {
  max-inline-size: 0;
  padding-inline: 0;
  overflow: hidden;
  opacity: 0;
  transition:
    max-inline-size var(--duration-normal) var(--ease-spring),
    padding var(--duration-normal) var(--ease-spring),
    opacity var(--duration-fast) var(--ease-out);
}

.view-island:is([data-expanded], :focus-within) .island-tab:not([data-current]) {
  max-inline-size: 8em;
  padding-inline: var(--space-xs);
  opacity: 1;
}

.island-position {
  display: flex;
  align-items: center;
  padding-inline: var(--space-2xs) var(--space-xs);
  color: var(--fg-muted);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.view-island:is([data-expanded], :focus-within) .island-position {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .island-tab:not([data-current]),
  .island-alert-enter-active,
  .island-alert-leave-active {
    transition: none;
  }
}
</style>
