import { createApp } from "vue"

import "@style/app.css"

import App from "./App.vue"
import router from "@router/index.js"
import { installMarkdownRuntime } from "@features/transcript-view/lib/markdown-runtime.js"

installMarkdownRuntime()

const app = createApp(App)
app.use(router)
app.mount("#app")
