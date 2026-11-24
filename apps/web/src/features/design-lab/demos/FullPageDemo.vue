<template>
  <AppLayout>
    <template #sidebar="{ onNavigate }">
      <SessionNav @navigate="onNavigate()" @settings="settingsOpen = true" />
    </template>

    <div class="split-area">
      <WorkbenchPane side="left" :session="session" :preset="preset" />
    </div>
  </AppLayout>

  <SettingsDialog v-model:open="settingsOpen" />
  <Toaster />
</template>

<script setup lang="ts">
import { computed, provide, ref, shallowRef } from "vue"
import { onBeforeRouteLeave } from "vue-router"
import AppLayout from "@components/layout/AppLayout.vue"
import { Toaster } from "@pig/ui/toast"
import { provideSharedBuckets } from "@features/composer/hooks/use-session-buckets.js"
import { useComposerQueue } from "@features/composer/hooks/use-composer-queue.js"
import { provideExtensionUi } from "@features/extension-ui/index.js"
import SessionNav from "@features/session-nav/index.vue"
import { navKey } from "@features/session-nav/index.js"
import SettingsDialog from "@features/settings/components/SettingsDialog.vue"
import { provideSplitView } from "@features/split-view/index.js"
import { transcriptModelsKey } from "@features/transcript-view/index.js"
import WorkbenchPane from "@/shell/WorkbenchPane.vue"
import {
  createPageNav,
  createPagePreset,
  createPageSession,
  PAGE_MODELS,
} from "@features/design-lab/lib/page-contexts.js"

const session = createPageSession()
const preset = createPagePreset()
const settingsOpen = ref(false)
const buckets = provideSharedBuckets()

provide(transcriptModelsKey, ref(PAGE_MODELS))

const nav = createPageNav(session)

provideSplitView(
  computed(() => session.sessionId.value),
  (id) => nav.openSession(id ?? ""),
)

provide(navKey, nav)

provideExtensionUi(
  { client: shallowRef() } as unknown as Parameters<typeof provideExtensionUi>[0],
  session as unknown as Parameters<typeof provideExtensionUi>[1],
)

useComposerQueue(buckets).enqueue("跑完测试后截一张 compact 的图")

onBeforeRouteLeave((to) => to.path.startsWith("/design"))
</script>

<style scoped>
.split-area {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
}
</style>
