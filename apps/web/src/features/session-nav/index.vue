<template>
  <div class="session-nav">
    <div class="titlebar-drag" aria-hidden="true"></div>

    <div class="nav-inset">
      <NavHeader @toggle="emit('toggle')" />
      <NavToolbar @create="onCreateSession" @search="openSearch" />

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
import { ArrowUp } from "@lucide/vue"
import { canonicalizeWorkspacePath } from "@client/local-cwd.js"
import { notifyError } from "@components/layout/notify.js"
import { useNav } from "@features/session-nav/index.js"
import NavFooter from "@features/session-nav/components/NavFooter.vue"
import NavHeader from "@features/session-nav/components/NavHeader.vue"
import NavToolbar from "@features/session-nav/components/NavToolbar.vue"
import SessionList from "@features/session-nav/components/SessionList.vue"
import { useSettings } from "@features/settings/index.js"

const SessionSearch = defineAsyncComponent(
  () => import("@features/session-nav/components/SessionSearch.vue"),
)
const emit = defineEmits<{
  navigate: [canonicalPath: string]
  toggle: []
}>()
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
  padding-inline: var(--nav-inline);
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

html[data-pig-desktop-platform="win32"] .session-nav > .titlebar-drag {
  display: none;
}

html[data-pig-desktop-platform] .session-nav {
  padding-top: calc(6px + var(--titlebar-inset));
}

html[data-pig-desktop-platform="win32"] .session-nav {
  padding-top: var(--spacing-xs);
}

html[data-pig-desktop-platform="darwin"] .session-nav {
  padding-top: var(--spacing-xxl);
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
</style>
