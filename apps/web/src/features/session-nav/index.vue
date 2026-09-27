<template>
  <div class="session-nav">
    <div class="titlebar-drag" aria-hidden="true"></div>

    <div class="nav-inset">
      <div class="nav-head">
        <RouterLink to="/" class="nav-brand press-scale" aria-label="pig">
          <span class="brand-mark">
            <img class="brand-pig" src="/logo-pig.png" alt="" width="22" height="22" />
          </span>

          <span class="brand-word" aria-hidden="true">pig</span>
        </RouterLink>

        <Tooltip>
          <TooltipTrigger as-child>
            <button class="nav-collapse" type="button" aria-label="收起侧边栏" @click="togglePanel">
              <PanelLeft class="size-icon" />
            </button>
          </TooltipTrigger>

          <TooltipContent>收起侧边栏</TooltipContent>
        </Tooltip>
      </div>

      <div class="nav-toolbar">
        <button class="nav-action" type="button" @click="onCreateSession">
          <MessageCirclePlus class="size-icon" />
          <span class="nav-label">新建会话</span>
        </button>

        <button class="nav-action" type="button" @click="openSearch">
          <Search class="size-icon" />
          <span class="nav-label">搜索</span>
          <kbd class="search-shortcut">Ctrl K</kbd>
        </button>
      </div>

      <p v-if="connected && !groups.length" class="add-guide">
        <ArrowUp class="size-icon motion-nudge" />
        点击新建会话添加工作目录
      </p>

      <SessionList @navigate="onSessionNavigate" @create-in-dir="onCreateInDir" />
    </div>

    <NavFooter @settings="openSettings" @search="openSearch" />
    <SessionSearch v-if="searchOpen" v-model:open="searchOpen" @navigate="onSessionNavigate" />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onMounted, shallowRef, watch } from "vue"
import { useEventListener } from "@vueuse/core"
import { useRouter } from "vue-router"
import { ArrowUp, MessageCirclePlus, PanelLeft, Search } from "@lucide/vue"
import { canonicalizeWorkspacePath } from "@client/local-cwd.js"
import { useLeftPanelToggle } from "@components/layout/hooks/use-left-panel.js"
import { notifyError } from "@components/layout/notify.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { useNav } from "@features/session-nav/index.js"
import NavFooter from "@features/session-nav/components/NavFooter.vue"
import SessionList from "@features/session-nav/components/SessionList.vue"
import { useSettings } from "@features/settings/index.js"

const SessionSearch = defineAsyncComponent(
  () => import("@features/session-nav/components/SessionSearch.vue"),
)
const emit = defineEmits<{
  navigate: [canonicalPath: string]
}>()
const { toggle: togglePanel } = useLeftPanelToggle()
const {
  groups,
  pinnedSessions,
  connected,
  lastCwd,
  highlightedSessionId,
  cancelPendingOpen,
  navError: workspaceError,
  addWorkspace,
} = useNav()
const { openSettings } = useSettings()
const router = useRouter()
const searchOpen = shallowRef(false)

onMounted(() => {
  const prefetch = () => {
    void import("@features/session-nav/components/SessionSearch.vue")
  }

  if (typeof requestIdleCallback === "function") requestIdleCallback(prefetch)
  else setTimeout(prefetch, 1)
})

function highlightedCwd(): string | undefined {
  const id = highlightedSessionId.value

  if (!id) return undefined

  const pinned = pinnedSessions.value.find((session) => session.id === id)

  if (pinned?.cwd) return canonicalizeWorkspacePath(pinned.cwd)

  for (const group of groups.value) {
    if (group.sessions.some((session) => session.id === id)) return group.canonicalPath
  }

  return undefined
}

function openSearch() {
  void import("@features/session-nav/components/SessionSearch.vue")
  searchOpen.value = true
}

useEventListener(window, "keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return
  event.preventDefault()
  openSearch()
})

watch(workspaceError, (message) => {
  const text = message.trim()

  if (text) notifyError(text)
})

function onSessionNavigate(cwd: string | undefined): void {
  if (cwd) emit("navigate", cwd)
}

function onCreateInDir(canonicalPath: string): void {
  cancelPendingOpen()
  emit("navigate", canonicalPath)
  void router.push("/")
}

function onCreateSession(): void {
  const path = highlightedCwd() ?? lastCwd.value ?? groups.value[0]?.canonicalPath

  if (path) onCreateInDir(path)
  else void addWorkspace()
}
</script>

<style scoped>
.session-nav {
  --nav-inline: var(--spacing-xs);
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  user-select: none;
}

.nav-inset {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding-block-start: var(--spacing-xxs);
  padding-inline: var(--nav-inline);
}

.nav-head {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
}

.nav-brand {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  margin-inline-start: calc(-1 * var(--spacing-xxs));
  padding: var(--spacing-xxs);
  border-radius: var(--radius-md);
  color: var(--ink);
  text-decoration: none;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.nav-brand:hover,
.nav-brand:focus-visible {
  background: var(--interaction-hover);
}

.brand-mark {
  display: block;
  flex: none;
  overflow: hidden;
  border-radius: var(--radius-xs);
  background: var(--brand-mark-bg);
}

.brand-pig {
  display: block;
  transform-origin: 30% 100%;
}

.nav-brand:hover .brand-pig,
.nav-brand:focus-visible .brand-pig {
  animation: brand-peek var(--duration-pig-peek) both;
}

.brand-word {
  color: var(--primary);
  font-family: var(--font-mono);
  font-size: var(--text-title);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.04em;
}

.nav-collapse {
  display: none;
  flex: none;
  align-items: center;
  justify-content: center;
  margin-inline-start: auto;
  padding: var(--icon-button-pad);
  -webkit-app-region: no-drag;
  app-region: no-drag;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-muted);
}

.nav-collapse:hover,
.nav-collapse:focus-visible {
  background: var(--hover-quiet);
  color: var(--ink);
}

.nav-toolbar {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--spacing-xxs);
}

.nav-action {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
  height: var(--size-nav-rail);
  padding-inline: var(--spacing-xs);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-caption--line-height);
  text-align: start;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.nav-action:hover {
  background: var(--interaction-hover);
}

.nav-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-shortcut {
  flex: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-faint);
  font: var(--text-caption-mono) / var(--text-caption-mono--line-height) var(--font-mono);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.nav-action:hover .search-shortcut,
.nav-action:focus-visible .search-shortcut {
  opacity: 1;
}

@media (max-width: 900px) {
  .nav-collapse {
    display: flex;
  }
}

.session-nav > .titlebar-drag {
  display: none;
  position: absolute;
  inset: 0 0 auto;
  height: var(--titlebar-inset);
  -webkit-app-region: drag;
  app-region: drag;
}

html[data-pig-desktop-platform] .session-nav > .titlebar-drag {
  display: block;
}

html[data-pig-desktop-platform] .session-nav {
  padding-top: calc(6px + var(--titlebar-inset));
}

html[data-pig-desktop-platform] .nav-head {
  position: absolute;
  z-index: 1;
  inset: 0 0 auto;
  height: calc(6px + var(--titlebar-inset));
  padding-inline: var(--nav-inline);
}

html[data-pig-desktop-platform="win32"] .session-nav {
  padding-top: var(--titlebar-inset);
}

html[data-pig-desktop-platform="win32"] .nav-head {
  height: var(--titlebar-inset);
}

html[data-pig-desktop-platform="darwin"] .session-nav {
  padding-top: var(--spacing-xxl);
}

html[data-pig-desktop-platform="darwin"] .nav-head {
  height: var(--spacing-xxl);
}

.add-guide {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xxs);
  margin: 0;
  padding-block: var(--spacing-xxs);
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
}

.add-guide .motion-nudge {
  margin-inline-start: var(--spacing-xs);
}

@media (max-width: 900px) {
  .session-nav {
    --nav-inline: var(--spacing-md);
  }
}

@media (prefers-reduced-motion: reduce) {
  .nav-action,
  .search-shortcut {
    transition: none;
  }

  .nav-brand:hover .brand-pig,
  .nav-brand:focus-visible .brand-pig {
    animation: none;
  }
}
</style>
