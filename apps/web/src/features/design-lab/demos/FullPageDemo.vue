<template>
  <AppLayout>
    <template #sidebar="{ onNavigate }">
      <SessionNav @navigate="onNavigate()" @settings="settingsOpen = true" />
    </template>

    <WorkbenchPane :session="session" :preset="preset" @center-change="paneCenterX = $event" />
  </AppLayout>

  <SettingsDialog v-model:open="settingsOpen" :archive="nav" />
  <Toaster />

  <NotificationStack>
    <template #avatar="{ item }">
      <ProjectIcon
        v-if="item.avatar?.kind === 'project'"
        :path="item.avatar.cwd"
        fallback="monogram"
      />

      <img
        v-else-if="item.avatar?.kind === 'brand'"
        src="/pwa-icon-192.png"
        alt=""
        class="notif-brand-icon"
      />
    </template>
  </NotificationStack>

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
import { computed, onBeforeUnmount, onMounted, provide, ref, shallowRef, watchEffect } from "vue"
import { onBeforeRouteLeave, RouterLink } from "vue-router"
import { ArrowLeftIcon } from "@components/icons/index.js"
import { Button } from "@pig/ui/button"
import AppLayout from "@components/layout/AppLayout.vue"
import { NotificationStack, pushNotification, resetNotifications } from "@pig/ui/notification"
import { Toaster, dismissToast, toastStatus } from "@pig/ui/toast"
import { provideSharedBuckets } from "@features/composer/hooks/use-session-buckets.js"
import { useComposerQueue } from "@features/composer/hooks/use-composer-queue.js"
import { provideExtensionUi } from "@features/extension-ui/index.js"
import { providePanelHost } from "@features/panel-host/index.js"
import SessionNav from "@features/session-nav/index.vue"
import { ProjectIcon, navKey } from "@features/session-nav/index.js"
import SettingsDialog from "@features/settings/components/SettingsDialog.vue"
import { transcriptModelsKey } from "@features/transcript-view/index.js"
import WorkbenchPane from "@/shell/WorkbenchPane.vue"
import {
  createPageNav,
  createPagePreset,
  createPageSession,
  PAGE_MODELS,
} from "@features/design-lab/lib/page-contexts.js"
import {
  PAGE_DIALOG,
  PAGE_QUEUED_PROMPTS,
  PAGE_SESSION_ID,
} from "@features/design-lab/lib/page-fixtures.js"

const session = createPageSession()
const preset = createPagePreset()
const settingsOpen = ref(false)
const paneCenterX = shallowRef<number>()
const buckets = provideSharedBuckets()

watchEffect(() => {
  if (typeof document === "undefined") return
  const x =
    settingsOpen.value || paneCenterX.value === undefined
      ? "50vw"
      : `${Math.round(paneCenterX.value)}px`
  document.documentElement.style.setProperty("--toast-anchor-x", x)
})

provide(transcriptModelsKey, ref(PAGE_MODELS))

const nav = createPageNav(session)
const host = providePanelHost(computed(() => session.sessionId.value))

provide(navKey, nav)

const extensionUi = provideExtensionUi(
  { client: shallowRef() } as unknown as Parameters<typeof provideExtensionUi>[0],
  session as unknown as Parameters<typeof provideExtensionUi>[1],
  host,
)

extensionUi.dialogs.value = [{ sessionId: PAGE_SESSION_ID, request: PAGE_DIALOG }]

onMounted(() => {
  toastStatus("lint 规则已更新", { tone: "info" })
  pushNotification({
    id: "lab-unread-waiting",
    title: "等你确认",
    body: "Banner 文案收敛",
    tone: "warning",
    keepUntilResolved: true,
    sessionId: "page-unread",
    avatar: { kind: "project", cwd: "G:/AICode/kumo" },
    actions: [
      {
        label: "打开",
        primary: true,
        run: () => nav.openSession("page-unread"),
      },
    ],
  })
  pushNotification({
    id: "lab-bg-done",
    title: "侧栏虚拟滚动",
    body: "这一轮已完成",
    tone: "success",
    sessionId: "page-running",
    avatar: { kind: "project", cwd: "G:/AICode/pig" },
    actions: [
      {
        label: "打开",
        primary: true,
        run: () => nav.openSession("page-running"),
      },
    ],
  })
})

onBeforeUnmount(() => {
  if (typeof document !== "undefined")
    document.documentElement.style.removeProperty("--toast-anchor-x")
  dismissToast()
  resetNotifications()
})

const queue = useComposerQueue(buckets)

queue.setKey(PAGE_SESSION_ID)
for (const text of PAGE_QUEUED_PROMPTS) queue.enqueue(text)

onBeforeRouteLeave((to) => to.path.startsWith("/design"))
</script>

<style scoped>
.lab-back {
  position: fixed;
  z-index: var(--z-drawer);
  inset-block-end: var(--space-md);
  inset-inline-end: var(--space-md);
}

.notif-brand-icon {
  inline-size: var(--icon-xl);
  block-size: var(--icon-xl);
  object-fit: cover;
}
</style>
