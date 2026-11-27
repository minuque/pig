<template>
  <section ref="root" class="workbench-pane" :style="drawerInset">
    <WorkbenchHeader
      :class="{ 'is-overlay': session.welcome.value }"
      :rail="!session.welcome.value"
    />

    <PaneBody :current="host.view.value" @step="host.stepView">
      <template #chat><SessionWorkbench /></template>
      <template #files><FilePanel /></template>
    </PaneBody>
  </section>
</template>

<script setup lang="ts">
import { shallowRef, useTemplateRef, watch } from "vue"
import { useEventListener, useResizeObserver } from "@vueuse/core"
import { provideComposerPreset, type ComposerPresetContext } from "@features/composer/index.js"
import FilePanel from "@features/file-pane/components/FilePanel.vue"
import { provideFilePane } from "@features/file-pane/index.js"
import { provideQuestionBoard } from "@features/extension-ui/hooks/use-question-board.js"
import PaneBody from "@features/panel-host/components/PaneBody.vue"
import { usePanelHost } from "@features/panel-host/index.js"
import { provideSession, type SessionContext } from "@features/session/index.js"
import { provideSessionRail } from "@features/session-rail/index.js"
import SessionWorkbench from "@features/session-workbench/index.vue"
import WorkbenchHeader from "@features/session-workbench/components/WorkbenchHeader.vue"

const props = defineProps<{
  session: SessionContext
  preset: ComposerPresetContext
  focusTask?: { sessionId: string; taskId: string; seq: number } | undefined
}>()
const emit = defineEmits<{
  centerChange: [centerX: number]
  railTasksVisibleChange: [visible: boolean]
}>()
const host = usePanelHost()
const root = useTemplateRef("root")
const drawerInset = shallowRef<Record<string, string>>()

function measureRect() {
  const rect = root.value?.getBoundingClientRect()

  if (!rect) return
  drawerInset.value = {
    "--drawer-inset": `${rect.top}px ${window.innerWidth - rect.right}px ${window.innerHeight - rect.bottom}px ${rect.left}px`,
  }
  emit("centerChange", rect.left + rect.width / 2)
}

useResizeObserver(root, measureRect)

useEventListener(window, "resize", measureRect)

provideSession(props.session)

provideComposerPreset(props.preset)

const rail = provideSessionRail()

watch(
  () => Boolean(rail.dockedShown.value || rail.pane.value?.kind === "tasks"),
  (visible) => emit("railTasksVisibleChange", visible),
  { immediate: true },
)

watch([() => props.focusTask?.seq, () => props.session.sessionId.value], ([_seq, activeId]) => {
  const target = props.focusTask

  if (target && activeId === target.sessionId)
    rail.openPane({ kind: "tasks", focus: target.taskId })
})

provideFilePane(props.session, host.showView)

provideQuestionBoard(props.session)
</script>

<style scoped>
.workbench-pane {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  flex: 1;
}
</style>
