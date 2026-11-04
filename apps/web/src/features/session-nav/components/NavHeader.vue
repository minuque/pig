<template>
  <div class="nav-head">
    <SidebarTitlebar @toggle-sidebar="emit('toggleSidebar')" @home="emit('home')" />

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
          <Kbd class="nav-row-kbd" size="s">{{ modKey }}N</Kbd>
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
          <Kbd class="nav-row-kbd" size="s">{{ modKey }}K</Kbd>
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
import SidebarTitlebar from "@features/session-nav/components/SidebarTitlebar.vue"
import SearchDialog from "@features/session-nav/components/SearchDialog.vue"
import type { SidebarSort } from "@features/session-nav/type.js"
import { ChatRoundAddIcon, MagnifierIcon } from "@components/icons/index.js"
import { Button } from "@components/ui/button/index.js"
import { Kbd } from "@components/ui/kbd/index.js"

defineProps<{
  searchOpen: boolean
  sessions: readonly SessionMetadata[]
  sort: SidebarSort
}>()

const emit = defineEmits<{
  "update:searchOpen": [open: boolean]
  toggleSidebar: []
  home: []
  create: [cwd?: string]
  open: [id: string]
}>()
const { t } = useI18n()
const isMac = /mac/i.test(navigator.platform || navigator.userAgent)
const modKey = isMac ? "⌘" : "Ctrl "
</script>

<style scoped>
/* 横向内边距交给子元素：header 自己带就会把底边线切成中间一截。
   这里也不能加 position：桌面壳的 .nav-titlebar 靠 .session-nav 定位贴顶。 */
.nav-head {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
  padding-block: var(--space-xxs);
}

.nav-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-xxs);
  padding-inline: var(--nav-inline);
}

/* 撑满整行：图标与文字靠左，kbd 靠右。
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

.nav-row-kbd {
  margin-inline-start: auto;
}
</style>
