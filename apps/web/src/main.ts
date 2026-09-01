import { createApp } from "vue"
import { setKaTeXWorker, setMermaidWorker } from "markstream-vue"
import KatexWorker from "markstream-vue/workers/katexRenderer.worker?worker&inline"
import MermaidWorker from "markstream-vue/workers/mermaidParser.worker?worker&inline"
import { applyDesktopPresentationMarker } from "./desktop-marker.js"
import "@style/app.css"
import App from "./App.vue"
import router from "@router/index.js"

applyDesktopPresentationMarker(window.location.href, document.documentElement)
setMermaidWorker(new MermaidWorker())
setKaTeXWorker(new KatexWorker())

const app = createApp(App)
app.use(router)
app.mount("#app")
