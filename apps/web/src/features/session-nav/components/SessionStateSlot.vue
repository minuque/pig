<template>
  <span class="state-slot">
    <span class="state-mark" aria-hidden="true">
      <span v-if="working" class="working-status">
        <CircleDashedIcon class="size-icon-lg working-icon" />
        <span>{{ t("session.sectionWorking") }}</span>
        <span class="working-elapsed">{{ elapsed }}</span>
      </span>

      <SessionStateIcon v-else-if="glyphState" :state="glyphState" />
      <span v-else class="time-label">{{ timeLabel }}</span>
    </span>

    <button
      v-if="!placeholder && !working"
      class="row-action press-scale"
      type="button"
      :aria-label="actionLabel"
      @click.prevent.stop="settled ? emit('unsettle') : emit('settle')"
      @pointerdown.stop="onActionPointerDown"
    >
      <Undo2Icon v-if="settled" class="size-icon" />
      <CheckIcon v-else class="size-icon" />
      <span v-if="variant === 'card'" class="row-action-label">{{ actionLabel }}</span>
    </button>
  </span>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { useIntervalFn } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import SessionStateIcon from "@features/session-nav/components/SessionStateIcon.vue"
import { sessionGlyph } from "@features/session-nav/lib/status-cycle.js"
import { formatRelativeTime } from "@features/session-nav/lib/format.js"
import { formatElapsed } from "@utils/time.js"
import type { SidebarRowFoot, SidebarSession } from "@features/session-nav/type.js"
import { CheckIcon, CircleDashedIcon, Undo2Icon } from "@components/icons/index.js"

const props = defineProps<{
  session: SidebarSession
  foot: SidebarRowFoot | undefined
  variant: "card" | "slim"
  settled: boolean
  startedAt: number | undefined
  placeholder: boolean
}>()
const emit = defineEmits<{
  settle: []
  unsettle: []
  sweepStart: [event: PointerEvent]
}>()
const { t } = useI18n()
const working = computed(() => props.variant === "card" && props.startedAt !== undefined)
const glyphState = computed(() => sessionGlyph(props.session, props.foot?.state))
const timeLabel = computed(() => formatRelativeTime(props.session.updatedAt))
const actionLabel = computed(() => (props.settled ? t("session.unsettle") : t("session.settle")))
const tick = shallowRef(Date.now())
const elapsed = computed(() =>
  props.startedAt === undefined
    ? ""
    : formatElapsed(tick.value - props.startedAt, { showMs: false }),
)
const clock = useIntervalFn(
  () => {
    tick.value = Date.now()
  },
  1_000,
  { immediate: false },
)

watch(
  working,
  (value) => {
    if (!value) {
      clock.pause()
      return
    }

    tick.value = Date.now()
    clock.resume()
  },
  { immediate: true },
)

function onActionPointerDown(event: PointerEvent) {
  if (event.button === 0 && !props.placeholder) emit("sweepStart", event)
}
</script>

<style scoped>
.state-slot {
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  min-width: var(--control-2xs);
  height: var(--control-2xs);
  margin-inline-start: auto;
}

.state-mark {
  display: grid;
  place-items: center;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.time-label {
  color: var(--fg-muted);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
  line-height: var(--text-meta--line-height);
  white-space: nowrap;
}

.working-status {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-2xs);
  color: var(--info-text);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-meta--line-height);
  white-space: nowrap;
}

.working-icon {
  flex: none;
}

.working-elapsed {
  font-variant-numeric: tabular-nums;
}

.session-item:is(:hover, :focus-within, .is-menu-open, .is-swept)
  .state-slot:has(.row-action)
  .state-mark {
  position: absolute;
  inset-inline-end: 0;
  opacity: 0;
}

.session-item:is(:hover, :focus-within, .is-menu-open, .is-swept) .row-action {
  position: relative;
  inset: auto;
  margin-inline-end: calc(var(--space-xs) * -1);
  translate: none;
}

.session-item:is(:hover, :focus-within, .is-menu-open, .is-swept) .session-card.slim .row-action {
  margin-inline-end: -2px;
}

.row-action {
  position: absolute;
  inset-inline-end: calc(var(--space-xs) * -1);
  top: 50%;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
  padding-block: 2px;
  padding-inline: var(--space-xs);
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  white-space: nowrap;
  translate: 0 -50%;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.session-card.slim .row-action {
  inset-inline-end: -2px;
  padding-inline: 2px;
}

.session-item:hover .row-action,
.session-item:focus-within .row-action,
.row-action:focus-visible,
.session-item.is-menu-open .row-action {
  opacity: 1;
  pointer-events: auto;
}

.row-action:hover,
.row-action:focus-visible {
  color: var(--fg);
}

.session-item.is-swept .state-mark {
  opacity: 0;
}

.session-item.is-swept .row-action {
  color: var(--fg);
  opacity: 1;
}

:global([data-drag-preview] .session-item .state-mark),
:global([data-drag-preview] .session-item .row-action) {
  opacity: 0;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .state-mark,
  .row-action {
    transition: none;
  }
}
</style>
