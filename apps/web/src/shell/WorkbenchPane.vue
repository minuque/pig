<template>
  <section
    ref="root"
    class="workbench-pane"
    :style="drawerInset"
    :data-side="side"
    :data-focused="split.focused.value === side || undefined"
    @pointerdown.capture="split.focusSide(side)"
    @focusin="split.focusSide(side)"
  >
    <WorkbenchHeader
      :class="{ 'is-overlay': session.welcome.value }"
      :rail="!session.welcome.value"
    />

    <PaneBody :current="view" @step="split.stepView(side, $event)">
      <template #chat><SessionWorkbench /></template>
      <template #files><FilePanel /></template>
    </PaneBody>
  </section>
</template>

<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from "vue"
import { useResizeObserver } from "@vueuse/core"
import { provideComposerPreset, type ComposerPresetContext } from "@features/composer/index.js"
import FilePanel from "@features/file-pane/components/FilePanel.vue"
import { provideFilePane } from "@features/file-pane/index.js"
import { provideQuestionBoard } from "@features/extension-ui/hooks/use-question-board.js"
import { provideSession, type SessionContext } from "@features/session/index.js"
import { provideSessionRail } from "@features/session-rail/index.js"
import SessionWorkbench from "@features/session-workbench/index.vue"
import WorkbenchHeader from "@features/session-workbench/components/WorkbenchHeader.vue"
import PaneBody from "@features/split-view/components/PaneBody.vue"
import { providePaneSide, useSplitView, type Side } from "@features/split-view/index.js"

const props = defineProps<{
  side: Side
  session: SessionContext
  preset: ComposerPresetContext
}>()
const split = useSplitView()
const view = computed(() => (props.session.sessionId.value ? split.view(props.side) : "chat"))
const root = useTemplateRef("root")
const drawerInset = shallowRef<Record<string, string>>()

useResizeObserver(root, () => {
  const rect = root.value?.getBoundingClientRect()

  if (rect)
    drawerInset.value = {
      "--drawer-inset": `${rect.top}px ${window.innerWidth - rect.right}px ${window.innerHeight - rect.bottom}px ${rect.left}px`,
    }
})

providePaneSide(props.side)

provideSession(props.session)

provideComposerPreset(props.preset)

provideSessionRail()

provideFilePane(props.session, (next) => split.showView(props.side, next))

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
