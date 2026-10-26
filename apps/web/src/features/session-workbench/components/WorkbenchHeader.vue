<template>
  <WorkbenchHeaderView
    :title="title"
    :session-id="currentId"
    :pinned="isPinned"
    :cwd-label="cwdLabel"
    :cwd-path="sessionCwd"
    :sidebar-expanded="sbState === 'expanded'"
    :sidebar-open="leftOpen"
    @toggle-sidebar="setSbState('expanded')"
    @rename="onRename"
    @toggle-pinned="onTogglePinned"
    @delete="onDelete"
  />
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useLeftPanelToggle } from "@components/layout/hooks/use-left-panel.js"
import { useNav } from "@features/session-nav/index.js"
import { workspaceName } from "@features/session-nav/lib/format.js"
import { useSession } from "@features/session-workbench/index.js"
import { workbenchHeaderTitle } from "@features/session-workbench/lib/session-state.js"
import WorkbenchHeaderView from "@features/session-workbench/components/WorkbenchHeaderView.vue"

const { leftOpen, sbState, setSbState } = useLeftPanelToggle()
const { sessionId, projection, sessionCwd } = useSession()
const {
  listedSessions,
  pinnedIds,
  highlightedSessionId,
  togglePinned,
  renameSession,
  deleteSession,
} = useNav()
const currentId = computed(() => sessionId.value ?? highlightedSessionId.value)
const isPinned = computed(() => (currentId.value ? pinnedIds.value.has(currentId.value) : false))
const title = computed(() =>
  workbenchHeaderTitle({
    sessionId: sessionId.value,
    listed: listedSessions.value,
    projectionName: projection.value?.name,
  }),
)
const cwdLabel = computed(() => (sessionCwd.value ? workspaceName(sessionCwd.value) : ""))

function onRename(name: string): void {
  const id = currentId.value

  if (id) void renameSession(id, name)
}

function onTogglePinned(): void {
  const id = currentId.value

  if (id) void togglePinned(id)
}

function onDelete(): void {
  const id = currentId.value

  if (id) void deleteSession(id)
}
</script>
