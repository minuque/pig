import { i18n } from "@i18n/index.js"
import { TooltipProvider } from "@components/ui/tooltip/index.js"
import { demoEn, demoZh } from "../src/stories/demo-messages.js"
import { withColorScheme, withFrame, withLocale, withTheme } from "../src/stories/decorators.js"
import "@style/app.css"
import type { Preview } from "@storybook/vue3-vite"
import { setup } from "@storybook/vue3-vite"

i18n.global.mergeLocaleMessage("zh-CN", demoZh)

i18n.global.mergeLocaleMessage("en", demoEn)

setup((app) => {
  app.use(i18n)
})

const preview: Preview = {
  globalTypes: {
    locale: {
      description: "组件文案语种",
      toolbar: {
        icon: "globe",
        items: [
          { value: "zh-CN", title: "中文" },
          { value: "en", title: "English" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { locale: "zh-CN" },
  decorators: [
    // 全局生效：最外层是 rt 的主题容器，再按 parameters.frameWidth / colorScheme 套壳。
    withTheme,
    withFrame,
    withColorScheme,
    withLocale,
    () => ({
      components: { TooltipProvider },
      template: "<TooltipProvider><story /></TooltipProvider>",
    }),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  setup(app) {
    app.use(i18n)
  },
}

export default preview
