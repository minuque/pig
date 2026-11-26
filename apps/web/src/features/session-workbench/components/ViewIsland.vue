<template>
  <span class="view-island" :style="{ inlineSize: `${slotWidth}px` }">
    <span
      class="island"
      data-island
      :data-face="face"
      :style="{ inlineSize: `${size.width}px`, blockSize: `${size.height}px` }"
      @pointerenter="hovered = true"
      @pointerleave="hovered = false"
      @focusin="focused = true"
      @focusout="focused = false"
    >
      <span
        ref="compact"
        class="island-face island-compact"
        :data-off="face !== 'compact' || undefined"
        aria-hidden="true"
      >
        <StatusIndicator
          v-if="runningLabel"
          class="island-running"
          status="running"
          size="s"
          pulse
        />

        <component :is="VIEW_ICONS[current]" class="size-icon" />
        <span class="island-meta">{{ runningLabel || position }}</span>
      </span>

      <span
        ref="tabs"
        class="island-face"
        :data-off="face !== 'tabs' || undefined"
        :inert="face === 'alert' || undefined"
      >
        <Tabs :value="current" @update:value="show">
          <TabsList class="island-tab-list" :aria-label="t('views.label')">
            <TabsTab v-for="view in PANE_VIEWS" :key="view" :value="view" class="island-tab">
              <component :is="VIEW_ICONS[view]" class="size-icon" />
              {{ t(`views.${view}`) }}
            </TabsTab>

            <TabsIndicator class="island-indicator" />
          </TabsList>
        </Tabs>
      </span>

      <Transition name="island-alert">
        <span
          v-if="waiting || alert"
          ref="card"
          :key="waiting ? 'waiting' : alertSeq"
          class="island-face island-alert"
          role="status"
          @pointerenter="holdAlert(true)"
          @pointerleave="holdAlert(false)"
        >
          <template v-if="waiting">
            <span class="island-alert-top">
              <StatusIndicator status="waiting" size="s" pulse />
              <span class="island-alert-title">{{ waiting.header }}</span>
            </span>

            <span class="island-alert-body">{{ waiting.message || waiting.question }}</span>

            <span class="island-alert-actions">
              <template v-if="confirming">
                <Button size="s" variant="ghost" color="neutral" @click="board.pick(0)">
                  {{ t("extensionUi.deny") }}
                </Button>

                <Button size="s" @click="board.pick(1)">{{ t("extensionUi.allow") }}</Button>
              </template>

              <Button v-else size="s" @click="backToChat">{{ t("extensionUi.answer") }}</Button>
            </span>
          </template>

          <template v-else-if="alert">
            <span class="island-alert-top">
              <StatusIndicator :status="alert.tone === 'info' ? 'running' : alert.tone" size="s" />
              <span class="island-alert-title">{{ alert.title }}</span>

              <span v-if="more" class="island-alert-more">
                {{ t("views.more", { count: more }) }}
              </span>
            </span>

            <span v-if="alert.body" class="island-alert-body">{{ alert.body }}</span>

            <span v-if="current !== 'chat'" class="island-alert-actions">
              <Button size="s" variant="secondary" @click="backToChat">
                {{ t("views.backToChat") }}
              </Button>
            </span>
          </template>
        </span>
      </Transition>
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useTemplateRef, watch } from "vue"
import { useElementSize, useIntervalFn } from "@vueuse/core"
import { Tabs, TabsIndicator, TabsList, TabsTab } from "@ui-sdk/vue/tabs"
import { useI18n } from "@i18n/index.js"
import { Button } from "@pig/ui/button"
import { StatusIndicator } from "@pig/ui/status-indicator"
import { useSession } from "@features/session/index.js"
import { useExtensionUi } from "@features/extension-ui/index.js"
import { useQuestionBoard } from "@features/extension-ui/hooks/use-question-board.js"
import { ALERT_TTL, PANE_VIEWS, usePanelHost, type PaneView } from "@features/panel-host/index.js"
import { formatElapsed } from "@utils/time.js"
import { FolderIcon, MessageSquareIcon } from "@components/icons/index.js"

const PEEK_MS = 1200
const VIEW_ICONS = { chat: MessageSquareIcon, files: FolderIcon } satisfies Record<
  PaneView,
  unknown
>
const { t } = useI18n()
const host = usePanelHost()
const current = host.view
const position = computed(() =>
  t("views.position", { index: PANE_VIEWS.indexOf(current.value) + 1, total: PANE_VIEWS.length }),
)
const hovered = shallowRef(false)
const focused = shallowRef(false)
const peeking = shallowRef(false)
const expanded = computed(() => hovered.value || focused.value || peeking.value)
let timer: ReturnType<typeof setTimeout> | undefined

watch(current, () => {
  clearTimeout(timer)
  peeking.value = true
  timer = setTimeout(() => (peeking.value = false), PEEK_MS)
})

const { turnPending, turnTimings } = useSession()
const now = shallowRef(Date.now())
const busySince = shallowRef<number>()
const since = computed(() =>
  turnPending.value
    ? (turnTimings.value?.findLast((timing) => timing.outcome === "running")?.startedAt ??
      busySince.value)
    : undefined,
)
const tick = useIntervalFn(() => (now.value = Date.now()), 1000, { immediate: false })
const runningLabel = computed(() =>
  since.value === undefined ? "" : formatElapsed(now.value - since.value, { showMs: false }),
)

watch(
  turnPending,
  (busy) => {
    now.value = Date.now()
    busySince.value = busy ? now.value : undefined

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
const alert = computed(() => host.alerts.current())
const more = computed(() => host.alerts.pending())
const alertSeq = shallowRef(0)
let alertTimer: ReturnType<typeof setTimeout> | undefined

function armAlert() {
  clearTimeout(alertTimer)
  const next = alert.value

  if (next) alertTimer = setTimeout(() => host.alerts.dismiss(), ALERT_TTL[next.kind])
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
  if (view === "chat") host.alerts.clear()
})

const face = computed(() =>
  waiting.value || alert.value ? "alert" : expanded.value ? "tabs" : "compact",
)
const box = { box: "border-box" } as const
const sizes = {
  compact: useElementSize(useTemplateRef<HTMLElement>("compact"), undefined, box),
  tabs: useElementSize(useTemplateRef<HTMLElement>("tabs"), undefined, box),
  alert: useElementSize(useTemplateRef<HTMLElement>("card"), undefined, box),
}
const size = computed(() => {
  const active = sizes[face.value]
  return { width: active.width.value, height: active.height.value }
})
const slotWidth = shallowRef(0)

watch(size, (next) => {
  if (face.value !== "alert") slotWidth.value = next.width
})

function backToChat() {
  host.showView("chat")
}

onBeforeUnmount(() => {
  clearTimeout(timer)
  clearTimeout(alertTimer)
})

function show(view: string | null) {
  const next = PANE_VIEWS.find((item) => item === view)

  if (next) host.showView(next satisfies PaneView)
}
</script>

<style scoped>
.view-island {
  position: relative;
  display: block;
  justify-self: center;
  block-size: var(--control-md);
  transition: inline-size var(--duration-slow) var(--ease-spring);
}

.island {
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 50%;
  z-index: var(--z-overlay);
  overflow: hidden;
  translate: -50% 0;
  border-radius: var(--radius-pill);
  corner-shape: round;
  background-color: var(--bg-surface);
  box-shadow: inset 0 0 0 var(--border-width) var(--border-subtle);
  transition:
    inline-size var(--duration-slow) var(--ease-spring),
    block-size var(--duration-slow) var(--ease-spring),
    border-radius var(--duration-slow) var(--ease-spring),
    box-shadow var(--duration-normal) var(--ease-out);
}

.island[data-face="alert"] {
  border-radius: var(--radius-card);
  box-shadow: var(--float-shadow);
}

.island-face {
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 0;
  inline-size: max-content;
  transition:
    opacity var(--duration-normal) var(--ease-out),
    filter var(--duration-normal) var(--ease-out),
    scale var(--duration-slow) var(--ease-spring);
}

.island-face[data-off] {
  opacity: 0;
  filter: blur(4px);
  scale: 0.96;
  pointer-events: none;
}

.island-compact {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  block-size: var(--control-md);
  padding-inline: var(--space-sm);
  color: var(--fg);
  font-size: var(--text-body);
  white-space: nowrap;
}

.island-meta {
  color: var(--fg-muted);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.island-tab-list {
  position: relative;
  display: flex;
  padding: var(--space-2xs);
}

.island-tab {
  position: relative;
  z-index: var(--z-raise);
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  block-size: calc(var(--control-md) - 2 * var(--space-2xs));
  padding-inline: var(--space-sm);
  border: 0;
  border-radius: var(--radius-pill);
  background: none;
  color: var(--fg-secondary);
  font: inherit;
  font-size: var(--text-body);
  white-space: nowrap;
  cursor: pointer;
  outline: none;
  transition: color var(--duration-normal) var(--ease-out);
}

.island-tab:is(:hover, [data-active]) {
  color: var(--fg);
}

.island-tab:focus-visible {
  box-shadow: inset var(--focus-ring);
}

.island-indicator {
  position: absolute;
  inset-block: var(--space-2xs);
  inset-inline-start: 0;
  inline-size: var(--active-tab-width);
  transform: translateX(var(--active-tab-left));
  border-radius: var(--radius-pill);
  background-color: var(--bg-selected);
  transition-property: transform, inline-size;
  transition-duration: var(--duration-slow);
  transition-timing-function: var(--ease-spring);
}

.island-indicator[data-activation-direction="none"] {
  transition: none;
}

.island-alert {
  display: grid;
  gap: var(--space-2xs);
  min-inline-size: 280px;
  max-inline-size: min(420px, 80vw);
  padding: var(--space-sm) var(--space-sm) var(--space-sm) var(--space-md);
}

.island-alert-top {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-inline-size: 0;
}

.island-alert-title {
  flex: 1;
  overflow: hidden;
  color: var(--fg);
  font-size: var(--text-body);
  font-weight: var(--font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.island-alert-more {
  flex-shrink: 0;
  color: var(--fg-muted);
  font-size: var(--text-meta);
}

.island-alert-body {
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

.island-alert-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-xs);
  margin-block-start: var(--space-2xs);
}

.island-alert-enter-active,
.island-alert-leave-active {
  transition:
    opacity var(--duration-normal) var(--ease-out),
    filter var(--duration-normal) var(--ease-out),
    scale var(--duration-slow) var(--ease-spring);
}

.island-alert-enter-from,
.island-alert-leave-to {
  opacity: 0;
  filter: blur(4px);
  scale: 0.96;
}

@media (prefers-reduced-motion: reduce) {
  .view-island,
  .island,
  .island-face,
  .island-indicator,
  .island-alert-enter-active,
  .island-alert-leave-active {
    transition: none;
  }
}
</style>
