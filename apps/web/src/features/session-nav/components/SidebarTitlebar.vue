<template>
  <div class="nav-titlebar">
    <RouterLink to="/" class="nav-brand" aria-label="pig" @click="emit('home')">
      <span class="brand-mark">
        <img class="brand-pig" src="/logo-pig.png" alt="" width="22" height="22" />
      </span>
    </RouterLink>

    <div class="nav-actions">
      <Tooltip>
        <TooltipTrigger as-child>
          <IconButton
            class="nav-btn"
            type="button"
            size="m"
            variant="ghost"
            :aria-label="t('session.newSession')"
            @click="emit('create')"
          >
            <AddIcon :size="15" />
          </IconButton>
        </TooltipTrigger>

        <TooltipContent>{{ t("session.newSession") }}</TooltipContent>
      </Tooltip>

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
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { AddIcon, PanelLeftCloseIcon } from "@components/icons/index.js"

const emit = defineEmits<{
  toggleSidebar: []
  create: []
  home: []
}>()
const { t } = useI18n()
</script>

<style scoped>
.nav-titlebar {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  padding-inline: var(--nav-inline);
}

.nav-brand {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  padding: var(--space-xxs) var(--space-xxs) var(--space-xxs) 0;
  border-radius: var(--radius-md);
  color: var(--contrast-foreground);
  text-decoration: none;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.nav-brand:hover,
.nav-brand:focus-visible {
  background: var(--interaction-hover);
}

.brand-mark {
  display: block;
  flex: none;
  overflow: hidden;
  border-radius: var(--radius-xs);
  background: var(--brand-mark-bg);
}

.brand-pig {
  display: block;
  transform-origin: 30% 100%;
}

.nav-brand:hover .brand-pig,
.nav-brand:focus-visible .brand-pig {
  animation: brand-peek var(--duration-pig-peek) both;
}

/* 两个图标按钮贴右并排，中间不留缝 */
.nav-actions {
  display: flex;
  flex: none;
  align-items: center;
  margin-inline-start: auto;
}

/* 尺寸与悬停由 IconButton 的 ghost 档接管，这里只补图标描边与拖窗豁免 */
.nav-btn {
  /* 15px 图标按 1.75 档缩放后描边只剩 1.09px，这一处单独加粗 */
  --solar-stroke-width: 2.25px;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

/* 桌面壳：标题条高度由 --titlebar-inset 一处给定，品牌行与卡片头同高对齐 */
html[data-pig-desktop-platform] .nav-titlebar {
  position: absolute;
  z-index: 1;
  inset: var(--workbench-inset) 0 auto;
  height: var(--titlebar-inset);
  padding-inline: var(--nav-inline);
}

/* macOS 红绿灯压在条带左上，品牌让出整簇宽度 */
html[data-pig-desktop-platform="darwin"] .nav-titlebar {
  padding-inline-start: calc(var(--size-mac-traffic-lights) + var(--space-xs));
}

/* Linux 走原生边框，页面内没有标题条，品牌行回到文档流 */
html[data-pig-desktop-platform="linux"] .nav-titlebar {
  position: static;
  height: auto;
}

@media (prefers-reduced-motion: reduce) {
  .nav-brand:hover .brand-pig,
  .nav-brand:focus-visible .brand-pig {
    animation: none;
  }
}
</style>
