import { createApp } from "vue"
import { enableKatex, enableMermaid } from "markstream-vue"

import "@style/app.css"

import App from "./App.vue"
import router from "@router/index.js"

enableMermaid()
enableKatex()

const app = createApp(App)
app.use(router)
app.mount("#app")
