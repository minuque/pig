<template>
  <nav class="nav-body session-list">
    <div v-if="sections.length" class="session-window">
      <section
        v-for="section in sections"
        :key="section.key"
        class="session-section"
        :data-key="section.key"
      >
        <div class="section-head" :class="{ open: expandedSections.has(section.key) }">
          <button
            class="section-toggle"
            type="button"
            :aria-expanded="expandedSections.has(section.key)"
            @click="emit('toggleSection', section.key)"
          >
            <span v-if="section.key === 'pinned'" class="section-icon" aria-hidden="true">
              <component
                :is="expandedSections.has(section.key) ? PinBoldIcon : PinIcon"
                :size="15"
              />
            </span>

            <span
              v-else-if="section.key.startsWith('date:')"
              class="section-icon"
              aria-hidden="true"
            >
              <ClockCircleIcon :size="15" />
            </span>

            <span v-else-if="section.cwd" class="section-icon" aria-hidden="true">
              <span
                v-if="sectionIcons[section.key]?.kind === 'monogram'"
                class="proj-mono"
                :style="{ background: monoColor(sectionIcons[section.key]) }"
              >
                {{ sectionIcons[section.key]?.value }}
              </span>

              <span v-else-if="sectionIcons[section.key]?.kind === 'emoji'" class="proj-emoji">
                {{ sectionIcons[section.key]?.value }}
              </span>

              <component
                v-else
                :is="projectIconComponent(sectionIcons[section.key])"
                :size="15"
                :style="sectionIconStyle(section)"
                :class="{ 'icon-muted': !expandedSections.has(section.key) }"
              />
            </span>

            <span
              class="section-label"
              :class="{ 'label-fade': sectionLabelOverflow[section.key] }"
              :data-key="section.key"
            >
              {{ section.label }}
            </span>

            <span v-if="!expandedSections.has(section.key)" class="section-count">
              {{ section.total }}
            </span>

            <span class="section-chevron" aria-hidden="true">
              <AltArrowDownIcon v-if="expandedSections.has(section.key)" :size="15" />
              <AltArrowRightIcon v-else :size="15" />
            </span>
          </button>

          <div v-if="section.cwd" class="section-actions">
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  class="section-add"
                  type="button"
                  :aria-label="t('session.newInProject')"
                  @click="emit('create', section.cwd)"
                >
                  <ChatRoundAddIcon :size="15" />
                </button>
              </TooltipTrigger>

              <TooltipContent>{{ t("session.newInProject") }}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div class="session-list-group" :class="{ 'is-open': expandedSections.has(section.key) }">
          <TransitionGroup name="list-reveal" tag="ul" class="section-rows">
            <li
              v-for="(session, index) in section.sessions"
              :key="session.id"
              class="session-row"
              :class="{
                'drop-before': section.key === 'pinned' && dragIndex === index,
                'drop-after':
                  section.key === 'pinned' &&
                  dragIndex === section.sessions.length &&
                  index === section.sessions.length - 1,
              }"
              :data-id="session.id"
            >
              <SessionItem
                v-bind="itemBind(session, section)"
                :dragging="dragId === session.id"
                @navigate="emit('navigate', session.cwd)"
                @open="emit('open', $event)"
                @prime="emit('prime', $event)"
                @toggle-pinned="emit('togglePinned', $event)"
                @rename="(id, name) => emit('rename', id, name)"
                @delete="emit('delete', $event)"
                @drag-start="onDragStart(section.key, session.id, $event)"
              />
            </li>

            <li
              v-if="section.shown < section.total || (expandedByGroup[section.key] ?? 0) > 0"
              :key="`more:${section.key}`"
              class="session-row more-row"
            >
              <button
                v-if="section.shown < section.total"
                class="more-button"
                type="button"
                @click="emit('revealMore', section.key)"
              >
                <DoubleAltArrowDownIcon :size="13" />
                {{ t("common.showMore") }}
              </button>

              <button
                v-else
                class="more-button"
                type="button"
                @click="emit('collapseGroup', section.key)"
              >
                <DoubleAltArrowUpIcon :size="13" />
                {{ t("common.collapse") }}
              </button>
            </li>
          </TransitionGroup>
        </div>
      </section>

      <div class="session-edge-bottom edge-veil-bottom" aria-hidden="true"></div>
    </div>

    <div v-else class="session-empty">{{ t("session.empty") }}</div>
  </nav>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, shallowRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import {
  loadProjIcons,
  projectIconComponent,
  projIconHex,
  type ProjIcon,
} from "@features/session-nav/lib/project-icon.js"
import { useColorScheme } from "@features/theme/index.js"
import SessionItem from "@features/session-nav/components/SessionItem.vue"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import {
  AltArrowDownIcon,
  AltArrowRightIcon,
  ChatRoundAddIcon,
  ClockCircleIcon,
  DoubleAltArrowDownIcon,
  DoubleAltArrowUpIcon,
  PinIcon,
  PinBoldIcon,
} from "@components/icons/index.js"
import type { SidebarRowFoot, SidebarSection, SidebarSession } from "@features/session-nav/type.js"

const props = defineProps<{
  sections: readonly SidebarSection[]
  scopeFilter?: string | undefined
  cardFootById: ReadonlyMap<string, SidebarRowFoot>
  pinnedIds: ReadonlySet<string>
  highlightedSessionId: string | undefined
  expandedSections: ReadonlySet<string>
  expandedByGroup: Record<string, number>
}>()
const emit = defineEmits<{
  navigate: [cwd: string | undefined]
  open: [id: string]
  prime: [id: string]
  create: [cwd?: string]
  togglePinned: [id: string]
  rename: [id: string, name: string]
  delete: [id: string]
  reorderPinned: [id: string, toIndex: number]
  toggleSection: [key: string]
  revealMore: [key: string]
  collapseGroup: [key: string]
}>()
const { t } = useI18n()
const { isDark } = useColorScheme()
// 过滤态下 pinned 段只渲染命中项，DOM 序号与 pinnedOrder 全表序号不再对应，禁用拖拽。
const dragEnabled = computed(() => !props.scopeFilter)
const projIcons = computed(loadProjIcons)
const sectionLabelOverflow = shallowRef<Record<string, boolean>>({})
const dragId = shallowRef<string | undefined>(undefined)
const dragIndex = shallowRef<number | undefined>(undefined)
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
  [() => props.sections, () => props.expandedSections],
  () => {
    nextTick(measureLabelOverflow)
  },
  { immediate: true },
)

const sectionIcons = computed<Record<string, ProjIcon | undefined>>(() => {
  const icons = projIcons.value
  return Object.fromEntries(
    props.sections.map((section) => [section.key, section.cwd ? icons[section.label] : undefined]),
  )
})

function monoColor(custom: ProjIcon | undefined) {
  if (!custom) return undefined
  return projIconHex(custom.color, isDark.value ? "dark" : "light")
}

function sectionIconStyle(section: { key: string }) {
  // 收起态调暗，让自定义色统一沉到 muted
  if (!props.expandedSections.has(section.key)) return undefined
  const custom = sectionIcons.value[section.key]
  return custom?.kind === "icon"
    ? { color: projIconHex(custom.color, isDark.value ? "dark" : "light") }
    : undefined
}

function itemBind(session: SidebarSession, _section: SidebarSection) {
  const foot = props.cardFootById.get(session.id)
  return {
    session,
    active: session.id === props.highlightedSessionId,
    pinned: props.pinnedIds.has(session.id),
    draggable: dragEnabled.value && props.pinnedIds.has(session.id),
    state: foot?.state,
    placeholder: session.draft ?? false,
  }
}

function onDragStart(sectionKey: string, id: string, _event: PointerEvent) {
  if (sectionKey !== "pinned") return

  const startIndex = props.sections
    .find((s) => s.key === "pinned")
    ?.sessions.findIndex((s) => s.id === id)

  if (startIndex === undefined || startIndex < 0) return
  dragId.value = id

  /** 用每行自己的矩形算落点：section 含组头，按 section 顶算会整体偏下。 */
  function onMove(e: PointerEvent) {
    const list = document.querySelector<HTMLElement>(`.session-list [data-key="pinned"]`)

    if (!list) return
    // 拖拽期间 sections 可能重算（别处 unpin 等），每次 move 即时取行数。
    const pinnedCount = props.sections.find((s) => s.key === "pinned")?.sessions.length ?? 0
    const rows = [...list.querySelectorAll<HTMLElement>(".session-row")].slice(0, pinnedCount)
    const y = e.clientY
    let index = rows.length

    for (const [i, row] of rows.entries()) {
      const box = row.getBoundingClientRect()

      if (y < box.top + box.height / 2) {
        index = i
        break
      }
    }

    dragIndex.value = index
  }

  function onUp() {
    const over = dragIndex.value

    if (over !== undefined && over !== startIndex) emit("reorderPinned", id, over)
    dragId.value = undefined
    dragIndex.value = undefined
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", onUp)
    dragCleanup = undefined
  }

  window.addEventListener("pointermove", onMove)
  window.addEventListener("pointerup", onUp)
  window.addEventListener("pointercancel", onUp)
  dragCleanup = () => onUp()
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
  scrollbar-width: thin;
  padding-block-start: var(--space-xxs);
}

.session-edge-bottom {
  background: linear-gradient(to top, var(--sidebar), transparent);
  height: 32px;
}

.session-section + .session-section {
  margin-block-start: var(--space-xs);
}

.section-head {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  min-width: 0;
  height: 26px;
  padding-inline: var(--space-xxs) 0;
  gap: var(--space-xxs);
}

.section-toggle {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--contrast-foreground-secondary);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-caption--line-height);
  cursor: default;
  user-select: none;
}

.section-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 15px;
  height: 15px;
}

.section-icon .proj-mono {
  display: grid;
  place-items: center;
  width: 15px;
  height: 15px;
  border-radius: var(--radius-xs);
  color: var(--primary-foreground);
  font: 700 8px/1 var(--font-mono);
}

.section-icon .proj-emoji {
  font-size: 15px;
  line-height: 1;
}

.section-icon .icon-muted {
  color: var(--contrast-foreground-muted) !important;
}

.section-head.open .section-toggle {
  color: var(--contrast-foreground);
}

.section-label {
  min-width: 0;
  overflow: hidden;
  line-height: var(--text-eyebrow--line-height);
  padding-block: 1px;
  margin-block: -1px;
  white-space: nowrap;
}

.section-label.label-fade {
  text-overflow: ellipsis;
}

.section-count {
  flex: none;
  height: 16px;
  margin-inline-end: var(--space-xxs);
  padding-inline: var(--space-xxs);
  border-radius: var(--radius-xs);
  background: var(--glass-selected-bg);
  color: var(--contrast-foreground-muted);
  font-family: var(--font-mono);
  font-size: var(--text-caption-mono);
  line-height: 16px;
}

/* 收展箭头：主按钮的一部分，hover 才出现，不单独可点 */
.section-chevron {
  display: grid;
  flex: none;
  place-items: center;
  width: 20px;
  height: 20px;
  color: var(--contrast-foreground-secondary);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.section-head:hover .section-chevron,
.section-toggle:focus-visible .section-chevron {
  opacity: 1;
}

.section-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-xxs);
  margin-inline-start: auto;
}

.section-add {
  display: grid;
  flex: none;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--contrast-foreground);
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

.section-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-xxs);
  margin: 0;
  padding: var(--space-xxs) var(--nav-inline, var(--space-xs)) 0 0;
  list-style: none;
}

.session-row {
  position: relative;
  display: flex;
  flex: none;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

/* 落点指示画在行上：独立成 TransitionGroup 子节点会卡在进出动画里。 */
.session-row.drop-before::before,
.session-row.drop-after::after {
  position: absolute;
  inset-inline: 0;
  height: 2px;
  background: var(--primary);
  border-radius: var(--radius-full);
  opacity: 0.6;
  content: "";
}

.session-row.drop-before::before {
  top: calc(var(--space-xxs) / -2 - 1px);
}

.session-row.drop-after::after {
  bottom: calc(var(--space-xxs) / -2 - 1px);
}

.more-button {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  width: 100%;
  height: 26px;
  padding-inline: var(--space-xs);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground-secondary);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  cursor: default;
  transition:
    background-color var(--duration-fast) var(--ease-hover),
    color var(--duration-fast) var(--ease-hover);
}

.more-button:hover {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.session-empty {
  padding: var(--space-xs);
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
}

@media (prefers-reduced-motion: reduce) {
  .section-add {
    transition: none;
  }
}
</style>
