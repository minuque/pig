import { createApp } from "vue"
import { disableMermaid } from "markstream-vue"
import { applyDesktopPresentationMarker } from "./desktop-marker.js"
import "@style/reset.css"
import "@style/app.css"
import App from "./App.vue"
import router from "@router/index.js"

applyDesktopPresentationMarker(window.location.href, document.documentElement)
disableMermaid()

const scrollingTimers = new WeakMap<Element, number>()
document.addEventListener(
  "scroll",
  (event) => {
    const el = event.target
    if (!(el instanceof Element) || el === document.documentElement || el === document.body) return
    el.classList.add("is-scrolling")
    const prev = scrollingTimers.get(el)
    if (prev) window.clearTimeout(prev)
    scrollingTimers.set(
      el,
      window.setTimeout(() => el.classList.remove("is-scrolling"), 800),
    )
  },
  { capture: true, passive: true },
)

const app = createApp(App)
app.use(router)
app.mount("#app")
