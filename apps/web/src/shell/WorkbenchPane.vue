<template>
  <section class="workbench-pane">
    <WorkbenchHeader
      :class="{ 'is-overlay': session.welcome.value }"
      :rail="!session.welcome.value"
    />

    <PaneBody :host="host">
      <SessionWorkbench />
    </PaneBody>

    <FilePane />
  </section>
</template>

<script setup lang="ts">
import { provideComposerPreset, type ComposerPresetContext } from "@features/composer/index.js"
import FilePane from "@features/file-pane/index.vue"
import { provideFilePane } from "@features/file-pane/index.js"
import PaneBody from "@features/panel-host/components/PaneBody.vue"
import { providePanelHost } from "@features/panel-host/index.js"
import { provideSession, type SessionContext } from "@features/session/index.js"
import { provideSessionRail } from "@features/session-rail/index.js"
import SessionWorkbench from "@features/session-workbench/index.vue"
import WorkbenchHeader from "@features/session-workbench/components/WorkbenchHeader.vue"

const props = defineProps<{
  session: SessionContext
  preset: ComposerPresetContext
}>()
const host = providePanelHost()

provideSession(props.session)

provideComposerPreset(props.preset)

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
