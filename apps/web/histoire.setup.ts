import "@style/app.css"

import { defineComponent, h } from "vue"
import { defineSetupVue3 } from "@histoire/plugin-vue"
import { i18n } from "@i18n/index.js"
import { ThemeRoot } from "@components/ui/rt/index.js"
import { TooltipProvider } from "@components/ui/tooltip/index.js"

/** 每个示例都套上应用根的作用域，否则 rt 的面板与阴影 token 取不到 */
const PreviewRoot = defineComponent({
  setup(_, { slots }) {
    return () =>
      h(ThemeRoot, { root: true }, () => h(TooltipProvider, null, () => slots.default?.()))
  },
})
export const setupVue3 = defineSetupVue3(({ app, addWrapper }) => {
  app.use(i18n)
  addWrapper(PreviewRoot)
})
