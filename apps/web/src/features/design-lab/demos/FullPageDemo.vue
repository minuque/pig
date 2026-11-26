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

  <Button variant="secondary" color="neutral" size="s" class="lab-back">
    <template #render="{ props: part }">
      <RouterLink v-slot="{ href, navigate }" to="/design" custom>
        <a v-bind="part" :href="href" @click="navigate">
          <ArrowLeftIcon class="size-icon-sm" />
          Design
        </a>
      </RouterLink>
    </template>
  </Button>
</template>

<script setup lang="ts">
import { computed, onMounted, provide, ref, shallowRef } from "vue"
import { onBeforeRouteLeave, RouterLink } from "vue-router"
import { ArrowLeftIcon } from "@components/icons/index.js"
import { Button } from "@pig/ui/button"
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
import { PAGE_DIALOG, PAGE_SESSION_ID } from "@features/design-lab/lib/page-fixtures.js"

const session = createPageSession()
const preset = createPagePreset()
const settingsOpen = ref(false)
const buckets = provideSharedBuckets()

provide(transcriptModelsKey, ref(PAGE_MODELS))

const nav = createPageNav(session)
const split = provideSplitView(
  computed(() => session.sessionId.value),
  (id) => nav.openSession(id ?? ""),
)

provide(navKey, nav)

const extensionUi = provideExtensionUi(
  { client: shallowRef() } as unknown as Parameters<typeof provideExtensionUi>[0],
  session as unknown as Parameters<typeof provideExtensionUi>[1],
  split,
)

extensionUi.dialogs.value = [{ sessionId: PAGE_SESSION_ID, request: PAGE_DIALOG }]

onMounted(() =>
  split.alerts.route(PAGE_SESSION_ID, { kind: "notify", tone: "info", title: "lint 规则已更新" }),
)

useComposerQueue(buckets).enqueue("跑完测试后截一张 compact 的图")

onBeforeRouteLeave((to) => to.path.startsWith("/design"))
</script>

<style scoped>
.lab-back {
  position: fixed;
  z-index: var(--z-drawer);
  inset-block-end: var(--space-md);
  inset-inline-end: var(--space-md);
}

.split-area {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
}
</style>
