import { i18n } from "@i18n/index.js"
import { TooltipProvider } from "@components/ui/tooltip/index.js"
import "@style/app.css"
import type { Preview } from "@storybook/vue3-vite"
import { setup } from "@storybook/vue3-vite"

setup((app) => {
  app.use(i18n)
})

const preview: Preview = {
  decorators: [
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

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "error",
    },
  },
  setup(app) {
    app.use(i18n)
  },
}

export default preview
