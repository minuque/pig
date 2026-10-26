import type { Decorator } from "@storybook/vue3-vite"
import { getCurrentInstance } from "vue"
import { createMemoryHistory, createRouter } from "vue-router"

import type { ColorScheme } from "@/types/theme-type.js"
import ThemeRoot from "@components/ui/rt/ThemeRoot.vue"
import { LEFT_PANEL_STATE_KEY } from "@components/layout/hooks/use-left-panel.js"
import { applyAccent, useColorScheme } from "@features/theme/index.js"
import { writePref } from "@utils/storage.js"

/** 模块级先建一次主题单例：放进故事 setup 会让它的 watcher 随第一个故事卸载而失效。 */
const theme = useColorScheme()

export interface FrameStoryParameters {
  /** 容器宽度，单位 px；不设置时装饰器只透传故事。 */
  frameWidth?: number
}

export interface SchemeStoryParameters {
  /** 深浅色；不设置时回到跟随系统。 */
  colorScheme?: ColorScheme
}

/**
 * 主题容器：rt 的组件样式依赖 .radix-themes 上的 token，故事里也要包一层。
 * html 的 data-accent-color 平时由首帧脚本写入，故事里补一次，:root 上引用 accent 的语义色
 * （--info 之类）才能解析。
 */
export const withTheme: Decorator = (story) => ({
  components: { ThemeRoot, story },
  setup: () => {
    applyAccent(theme.accent.value)
  },
  template: "<ThemeRoot><story /></ThemeRoot>",
})
/** 宽度容器：parameters.frameWidth 定宽，没设就原样渲染，不影响已有故事。 */
export const withFrame: Decorator = (story, context) => {
  const frameWidth = (context.parameters as FrameStoryParameters).frameWidth

  if (!frameWidth) return story()
  return {
    template: `<div class="story-frame" style="width:${frameWidth}px;max-width:100%;min-height:100%"><story /></div>`,
  }
}
/** 深浅色：每次进故事都显式设一次，避免上一条故事的暗色残留到默认故事。 */
export const withColorScheme: Decorator = (_story, context) => {
  const scheme = (context.parameters as SchemeStoryParameters).colorScheme ?? "auto"
  return {
    setup: () => {
      theme.setScheme(scheme)
    },
    template: "<story />",
  }
}
/** SessionItem 用 RouterLink 出卡片链接，故事里补一个内存路由。 */
const memoryRouter = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: "/", name: "home", component: { render: () => null } },
    { path: "/session/:sessionId", name: "session", component: { render: () => null } },
  ],
})
export const withMemoryRouter: Decorator = (story) => ({
  components: { story },
  setup: () => {
    getCurrentInstance()?.appContext.app.use(memoryRouter)
  },
  template: "<story />",
})
/** 侧栏展开态存在 localStorage，故事之间会互相污染：每帧先强制展开。 */
export const withExpandedSidebar: Decorator = (story) => {
  writePref(LEFT_PANEL_STATE_KEY, "expanded")
  return story()
}
