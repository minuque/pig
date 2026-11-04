<template>
  <div class="nav-head">
    <div class="nav-titlebar">
      <Tooltip>
        <TooltipTrigger as-child>
          <IconButton
            class="nav-btn"
            type="button"
            size="m"
            variant="ghost"
            :aria-label="t('nav.collapseSidebar')"
            @click="emit('toggleSidebar')"
          >
            <PanelLeftCloseIcon :size="15" />
          </IconButton>
        </TooltipTrigger>

        <TooltipContent>{{ t("nav.collapseSidebar") }}</TooltipContent>
      </Tooltip>
    </div>

    <div class="nav-rows">
      <Button
        class="nav-row press-scale"
        type="button"
        size="m"
        variant="ghost"
        color="gray"
        @click="emit('create')"
      >
        <ChatRoundAddIcon :size="15" />
        <span>{{ t("session.newSession") }}</span>

        <template #suffix>
          <Badge class="nav-row-key" variant="soft" color="gray">{{ modKey }}N</Badge>
        </template>
      </Button>

      <Button
        class="nav-row press-scale"
        type="button"
        size="m"
        variant="ghost"
        color="gray"
        @click="emit('update:searchOpen', true)"
      >
        <MagnifierIcon :size="15" />
        <span>{{ t("nav.search") }}</span>

        <template #suffix>
          <Badge class="nav-row-key" variant="soft" color="gray">{{ modKey }}K</Badge>
        </template>
      </Button>
    </div>

    <SearchDialog
      :open="searchOpen"
      :sessions="sessions"
      :sort="sort"
      @update:open="emit('update:searchOpen', $event)"
      @open="emit('open', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { SessionMetadata } from "@/types/common-type.js"
import { useI18n } from "@i18n/index.js"
import SearchDialog from "@features/session-nav/components/SearchDialog.vue"
import type { SidebarSort } from "@features/session-nav/type.js"
import { ChatRoundAddIcon, MagnifierIcon, PanelLeftCloseIcon } from "@components/icons/index.js"
import { Badge } from "@components/ui/badge/index.js"
import { Button, IconButton } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"

defineProps<{
  searchOpen: boolean
  sessions: readonly SessionMetadata[]
  sort: SidebarSort
}>()

const emit = defineEmits<{
  "update:searchOpen": [open: boolean]
  toggleSidebar: []
  create: [cwd?: string]
  open: [id: string]
}>()
const { t } = useI18n()
const isMac = /mac/i.test(navigator.platform || navigator.userAgent)
const modKey = isMac ? "⌘" : "Ctrl "
</script>

<style scoped>
.nav-head {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
  /* 上边不内缩：首行与工作台头部内元素落在同一条横线上 */
  padding-block: 0 var(--space-xxs);
}

/* 首行与工作台头部同高：两栏首行共用一条横向基线 */
.nav-titlebar {
  display: flex;
  align-items: center;
  min-width: 0;
  height: var(--header-height);
  padding-inline: var(--nav-inline);
}

/* 图标按钮贴左；描边与拖窗豁免由这一处给 */
.nav-btn {
  /* 15px 图标按 1.75 档缩放后描边只剩 1.09px，这一处单独加粗 */
  --solar-stroke-width: 2.25px;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

/* macOS 的红绿灯压在首行左上，收起按钮让出整簇宽度 */
html[data-pig-desktop-platform="darwin"] .nav-titlebar {
  padding-inline-start: calc(var(--size-mac-traffic-lights) + var(--space-xs));
}

/* Windows 藏起标题条，首行落进系统标题条这一行，可拖窗 */
html[data-pig-desktop-platform="win32"] .nav-titlebar {
  -webkit-app-region: drag;
  app-region: drag;
}

.nav-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-xxs);
  padding-inline: var(--nav-inline);
}

/* 撑满整行：图标与文字靠左，快捷键角标靠右。
   rt 的 ghost 档是 content-box 且用负外边距做视觉对齐，整行按钮要抵消掉。 */
.nav-row {
  box-sizing: border-box;
  justify-content: flex-start;
  gap: var(--space-xs);
  width: 100%;
  margin: 0;
  padding-inline: var(--space-xs);
  font-weight: 400;
}

.nav-row-key {
  margin-inline-start: auto;
}
</style>
