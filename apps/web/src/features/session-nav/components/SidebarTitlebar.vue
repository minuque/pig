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
import { PanelLeftCloseIcon } from "@components/icons/index.js"

const emit = defineEmits<{
  toggleSidebar: []
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
  /* 与工作台头部同高：两栏首行共用一条横向基线 */
  height: var(--header-height);
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

/* 收起按钮贴右 */
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

/* 桌面壳：macOS 的标题条是浮层，品牌行与红绿灯同处一条带，左侧让出整簇宽度；
   Windows 与 Linux 走原生边框，品牌行留在文档流里。 */
html[data-pig-desktop-platform="darwin"] .nav-titlebar {
  position: absolute;
  z-index: 1;
  inset: 0 0 auto;
  height: var(--titlebar-inset);
  padding-inline: var(--nav-inline) var(--nav-inline) var(--nav-inline)
    calc(var(--size-mac-traffic-lights) + var(--space-xs));
}

@media (prefers-reduced-motion: reduce) {
  .nav-brand:hover .brand-pig,
  .nav-brand:focus-visible .brand-pig {
    animation: none;
  }
}
</style>
