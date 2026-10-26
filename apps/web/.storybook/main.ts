import type { StorybookConfig } from "@storybook/vue3-vite"
import type { PluginOption } from "vite"

/** devtools 在故事面板里无意义，且应用卸载后仍读 activeAppRecord 会留下 unhandled rejection。 */
const DEVTOOLS_PLUGIN = "vite-plugin-vue-devtools"
const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-docs"],
  framework: "@storybook/vue3-vite",
  viteFinal(viteConfig) {
    const plugins = (viteConfig.plugins ?? []).flat() as PluginOption[]
    return {
      ...viteConfig,
      plugins: plugins.filter((plugin) => plugin?.name !== DEVTOOLS_PLUGIN),
    }
  },
}

export default config
