import { i18n } from "@i18n/index.js"
import { TooltipProvider } from "@components/ui/tooltip/index.js"
import { withColorScheme, withFrame, withTheme } from "../src/stories/decorators.js"
import "@style/app.css"
import type { Preview } from "@storybook/vue3-vite"
import { setup } from "@storybook/vue3-vite"

setup((app) => {
  app.use(i18n)
})

const preview: Preview = {
  decorators: [
    // 全局生效：最外层是 rt 的主题容器，再按 parameters.frameWidth / colorScheme 套壳。
    withTheme,
    withFrame,
    withColorScheme,
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
