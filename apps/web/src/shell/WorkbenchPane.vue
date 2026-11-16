<template>
  <section
    class="workbench-pane"
    :data-side="side"
    :data-focused="split.focused.value === side || undefined"
    @pointerdown.capture="split.focusSide(side)"
    @focusin="split.focusSide(side)"
  >
    <WorkbenchHeader
      :class="{ 'is-overlay': session.welcome.value }"
      :rail="!session.welcome.value"
    />

    <PaneBody :host="host" :split="split.split.value">
      <SessionWorkbench />
    </PaneBody>

    <FilePane />
  </section>
</template>

<script setup lang="ts">
import FilePane from "@features/file-pane/index.vue"
import { provideFilePane } from "@features/file-pane/index.js"
import { provideSession, type SessionContext } from "@features/session/index.js"
import { provideSessionRail } from "@features/session-rail/index.js"
import SessionWorkbench from "@features/session-workbench/index.vue"
import WorkbenchHeader from "@features/session-workbench/components/WorkbenchHeader.vue"
import PaneBody from "@features/split-view/components/PaneBody.vue"
import {
  providePaneSide,
  providePanelHost,
  useSplitView,
  type Side,
} from "@features/split-view/index.js"

const props = defineProps<{ side: Side; session: SessionContext }>()
const split = useSplitView()

providePaneSide(props.side)

const host = providePanelHost()

provideSession(props.session)

provideSessionRail()

provideFilePane(props.session)
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
