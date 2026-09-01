import { createApp } from "vue"
import { disableMermaid } from "markstream-vue"
import { applyDesktopPresentationMarker } from "./desktop-marker.js"
import "@style/app.css"
import App from "./App.vue"
import router from "@router/index.js"

applyDesktopPresentationMarker(window.location.href, document.documentElement)
disableMermaid()

function stripA11y(node: Node) {
  if (!(node instanceof Element)) return
  const drop = (el: Element) => {
    for (const { name } of [...el.attributes]) {
      if (name === "role" || name.startsWith("aria-")) el.removeAttribute(name)
    }
  }
  drop(node)
  node.querySelectorAll("*").forEach(drop)
}

stripA11y(document.body)
new MutationObserver((records) => {
  for (const rec of records) {
    if (rec.type === "childList") rec.addedNodes.forEach(stripA11y)
    else if (
      rec.target instanceof Element &&
      rec.attributeName &&
      (rec.attributeName === "role" || rec.attributeName.startsWith("aria-"))
    ) {
      rec.target.removeAttribute(rec.attributeName)
    }
  }
}).observe(document.body, { subtree: true, childList: true, attributes: true })

const app = createApp(App)
app.use(router)
app.mount("#app")
