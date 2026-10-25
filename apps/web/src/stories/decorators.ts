import type { Decorator } from "@storybook/vue3-vite"
import type { ColorScheme } from "@/types/theme-type.js"
import { useColorScheme } from "@features/theme/index.js"

/** 侧栏与正文的常用容器宽度（px）。 */
export const FRAME_WIDTH = { sidebar: 260, transcript: 760 } as const
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

function frameOf(frameWidth: number): Decorator {
  return (story, context) =>
    withFrame(story, {
      ...context,
      parameters: { ...context.parameters, frameWidth } satisfies FrameStoryParameters,
    })
}

function schemeOf(colorScheme: ColorScheme): Decorator {
  return (story, context) =>
    withColorScheme(story, {
      ...context,
      parameters: { ...context.parameters, colorScheme } satisfies SchemeStoryParameters,
    })
}

export const withSidebarFrame = frameOf(FRAME_WIDTH.sidebar)
export const withTranscriptFrame = frameOf(FRAME_WIDTH.transcript)
export const withDarkTheme = schemeOf("dark")
export const withLightTheme = schemeOf("light")
