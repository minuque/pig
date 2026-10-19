<template>
  <nav class="nav-body session-list">
    <div v-if="sections.length" class="session-window">
      <section
        v-for="section in sections"
        :key="section.key"
        class="session-section"
        :data-key="section.key"
      >
        <div class="section-head">
          <button
            class="section-chevron motion-turn"
            :class="{ 'is-on': !collapsedSections.has(section.key) }"
            type="button"
            :aria-expanded="!collapsedSections.has(section.key)"
            @click="toggleSection(section.key)"
          >
            <AltArrowRightIcon :size="12" />
          </button>

          <button
            class="section-toggle"
            type="button"
            :aria-expanded="!collapsedSections.has(section.key)"
            @click="toggleSection(section.key)"
          >
            <span v-if="section.cwd" class="section-icon" aria-hidden="true">
              <span
                v-if="sectionIcon(section)?.kind === 'monogram'"
                class="proj-mono"
                :style="{ background: sectionIcon(section)?.color }"
              >
                {{ sectionIcon(section)?.value }}
              </span>

              <span v-else-if="sectionIcon(section)?.kind === 'emoji'" class="proj-emoji">
                {{ sectionIcon(section)?.value }}
              </span>

              <component
                v-else
                :is="projectIconComponent(sectionIcon(section))"
                :size="13"
                :style="sectionIconStyle(section)"
              />
            </span>

            <span
              class="section-label"
              :class="{ 'label-fade': sectionLabelOverflow[section.key] }"
              :data-key="section.key"
            >
              {{ section.label }}
            </span>

            <span v-if="collapsedSections.has(section.key)" class="section-count">
              {{ section.sessions.length + (section.more ? "+" : "") }}
            </span>
          </button>

          <Tooltip v-if="section.cwd">
            <TooltipTrigger as-child>
              <button
                class="section-add"
                type="button"
                :aria-label="t('session.newInProject')"
                @click="emit('create', section.cwd)"
              >
                <ChatRoundAddIcon :size="13" />
              </button>
            </TooltipTrigger>

            <TooltipContent>{{ t("session.newInProject") }}</TooltipContent>
          </Tooltip>
        </div>

        <div class="session-list-group" :class="{ 'is-open': !collapsedSections.has(section.key) }">
          <div class="section-body">
            <TransitionGroup name="list-reveal" tag="ul" class="section-rows">
              <template v-for="(session, index) in section.sessions" :key="session.id">
                <li
                  v-if="dragOver && section.key === 'pinned' && dragOver.index === index"
                  class="session-row drag-gap"
                  aria-hidden="true"
                ></li>

                <li class="session-row" :data-id="session.id">
                  <SessionItem
                    v-bind="itemBind(session)"
                    :dragging="dragId === session.id"
                    @navigate="emit('navigate', session.cwd)"
                    @toggle-pinned="togglePinned"
                    @rename="renameSession"
                    @delete="deleteSession"
                    @project-settings="emit('projectSettings', $event)"
                    @drag-start="onDragStart(section.key, session.id, $event)"
                  />
                </li>
              </template>

              <li
                v-if="
                  dragOver && section.key === 'pinned' && dragOver.index === section.sessions.length
                "
                class="session-row drag-gap"
                aria-hidden="true"
              ></li>

              <li v-if="section.more" :key="`more:${section.key}`" class="session-row">
                <button class="more-button" type="button" @click="toggleGroupReveal(section.key)">
                  {{ section.revealed ? t("common.collapse") : t("common.showMore") }}
                </button>
              </li>
            </TransitionGroup>
          </div>
        </div>
      </section>

      <div class="session-edge-bottom edge-veil-bottom" aria-hidden="true"></div>
    </div>

    <div v-else class="session-empty">{{ t("session.empty") }}</div>
  </nav>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, shallowRef, watch } from "vue"
import { useTimestamp } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { useNav, workspaceName } from "@features/session-nav/index.js"
import { filterSessionsForSearch } from "@features/session-nav/lib/session-list.js"
import {
  loadProjIcons,
  projectIconComponent,
  type ProjIcon,
} from "@features/session-nav/lib/project-icon.js"
import SessionItem from "@features/session-nav/components/SessionItem.vue"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { AltArrowRightIcon, ChatRoundAddIcon } from "@components/icons/index.js"
import type { SidebarSession } from "@features/session-nav/type.js"

const props = defineProps<{
  scopeFilter?: string | undefined
  query?: string
}>()
const emit = defineEmits<{
  navigate: [cwd: string | undefined]
  projectSettings: [project: string]
  create: [cwd?: string]
}>()
const { t } = useI18n()
const {
  cardFootById,
  listedSessions,
  toggleGroupReveal,
  sectionsFor,
  collapsedSections,
  toggleSection,
  pinnedIds,
  togglePinned,
  highlightedSessionId,
  renameSession,
  deleteSession,
  reorderPinned,
} = useNav()
const now = useTimestamp({ interval: 60_000 })
const searching = computed(() => Boolean(props.query?.trim()))
const include = computed(() => {
  const needle = props.query?.trim()
  const allowed = needle
    ? new Set(filterSessionsForSearch(listedSessions.value, needle).map((session) => session.id))
    : undefined
  return (session: { id: string; cwd?: string }) => {
    if (allowed && !allowed.has(session.id)) return false
    return !props.scopeFilter || workspaceName(session.cwd ?? "") === props.scopeFilter
  }
})
const sections = sectionsFor(searching, include)
const projIcons = computed(loadProjIcons)
const sectionLabelOverflow = shallowRef<Record<string, boolean>>({})
const dragId = shallowRef<string | undefined>(undefined)
const dragOver = shallowRef<{ index: number; top: number } | undefined>(undefined)
let dragCleanup: (() => void) | undefined

function measureLabelOverflow() {
  const map: Record<string, boolean> = {}
  document.querySelectorAll<HTMLElement>(".session-list .section-label").forEach((el) => {
    const key = el.getAttribute("data-key")

    if (key) map[key] = el.scrollWidth > el.clientWidth + 1
  })
  sectionLabelOverflow.value = map
}

watch(
  [sections, () => collapsedSections.value],
  () => {
    nextTick(measureLabelOverflow)
  },
  { immediate: true },
)

function sectionIcon(section: { cwd?: string; label: string }): ProjIcon | undefined {
  return section.cwd ? projIcons.value[section.label] : undefined
}

function sectionIconStyle(section: { cwd?: string; label: string }) {
  const custom = sectionIcon(section)
  return custom?.kind === "icon" ? { color: custom.color } : undefined
}

function itemBind(session: SidebarSession) {
  const foot = cardFootById.value.get(session.id)
  return {
    session,
    active: session.id === highlightedSessionId.value,
    pinned: pinnedIds.value.has(session.id),
    state: foot?.state,
    placeholder: session.draft ?? false,
    now: now.value,
  }
}

function onDragStart(sectionKey: string, id: string, event: PointerEvent) {
  if (sectionKey !== "pinned") return
  dragId.value = id
  const startY = event.clientY
  const startIndex = sections.value
    .find((s) => s.key === "pinned")
    ?.sessions.findIndex((s) => s.id === id)

  if (startIndex === undefined || startIndex < 0) return

  const list = document.querySelector<HTMLElement>(`.session-list [data-key="pinned"]`)
  const rows = list?.querySelectorAll<HTMLElement>(".session-row") ?? []
  const tops = [...rows]
    .map((r) => r.getBoundingClientRect().top)
    .filter((_, i) => i < sections.value.find((s) => s.key === "pinned")!.sessions.length)
  const heights = [...rows]
    .map((r) => r.getBoundingClientRect().height)
    .filter((_, i) => i < sections.value.find((s) => s.key === "pinned")!.sessions.length)

  function onMove(e: PointerEvent) {
    const y = e.clientY
    const list = document.querySelector<HTMLElement>(`.session-list [data-key="pinned"]`)

    if (!list) return
    const rect = list.getBoundingClientRect()
    const rel = y - rect.top
    let index = 0
    let acc = 0

    for (let i = 0; i < heights.length; i++) {
      const mid = acc + heights[i]! / 2

      if (rel < mid) {
        index = i
        break
      }

      acc += heights[i]!
      index = i + 1
    }

    const top = tops[Math.min(index, tops.length - 1)] ?? rect.bottom
    dragOver.value = { index, top }
  }

  function onUp(e: PointerEvent) {
    const over = dragOver.value?.index

    if (over !== undefined && over !== startIndex) reorderPinned(id, over)
    dragId.value = undefined
    dragOver.value = undefined
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", onUp)
    dragCleanup = undefined
  }

  window.addEventListener("pointermove", onMove)
  window.addEventListener("pointerup", onUp)
  window.addEventListener("pointercancel", onUp)
  dragCleanup = () => onUp(event)
}

onBeforeUnmount(() => {
  dragCleanup?.()
})
</script>

<style scoped>
.nav-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.session-list {
  position: relative;
}

.session-window {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none;
  padding-block-start: var(--spacing-xxs);
}

.session-edge-bottom {
  background: linear-gradient(to top, var(--sidebar), transparent);
  height: 32px;
}

.session-section + .session-section {
  margin-block-start: var(--spacing-sm);
}

.section-head {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  min-width: 0;
  height: 28px;
  padding-inline: var(--spacing-xxs) var(--spacing-xs);
  gap: var(--spacing-xxs);
}

.section-toggle {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-medium);
  line-height: 1;
  cursor: default;
  user-select: none;
}

.section-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 13px;
  height: 13px;
}

.section-icon .proj-mono {
  display: grid;
  place-items: center;
  width: 13px;
  height: 13px;
  border-radius: var(--radius-xs);
  color: var(--primary-foreground);
  font: 700 7px/1 var(--font-mono);
}

.section-icon .proj-emoji {
  font-size: 11px;
  line-height: 1;
}

.section-label {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.section-label.label-fade {
  -webkit-mask-image: linear-gradient(to right, black calc(100% - 20px), transparent);
  mask-image: linear-gradient(to right, black calc(100% - 20px), transparent);
}

.section-count {
  flex: none;
  height: 16px;
  margin-inline-end: var(--spacing-xxs);
  padding-inline: var(--spacing-xxs);
  border-radius: var(--radius-xs);
  background: var(--glass-selected-bg);
  color: var(--contrast-foreground-muted);
  font-family: var(--font-mono);
  font-size: var(--text-caption-mono);
  line-height: 16px;
}

.section-chevron {
  display: grid;
  flex: none;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--contrast-foreground-faint);
}

.section-add {
  display: grid;
  flex: none;
  place-items: center;
  width: 20px;
  height: 20px;
  margin-inline-start: auto;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--contrast-foreground-muted);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.section-head:hover .section-add,
.section-add:focus-visible {
  opacity: 1;
}

.section-add:hover {
  background: var(--glass-selected-bg);
  color: var(--contrast-foreground);
}

.section-body {
  padding-block-start: var(--spacing-xxs);
}

.section-rows {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.session-row {
  display: flex;
  flex: none;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.session-row.drag-gap {
  height: 2px;
  margin-block: -1px;
  background: var(--primary);
  border-radius: var(--radius-full);
  opacity: 0.6;
}

.more-button {
  align-self: flex-start;
  padding: 0 var(--spacing-xs);
  border: 0;
  background: transparent;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
  cursor: default;
}

.more-button:hover {
  color: var(--contrast-foreground);
}

.session-empty {
  padding: var(--spacing-xs);
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
}

@media (prefers-reduced-motion: reduce) {
  .section-add {
    transition: none;
  }
}
</style>
