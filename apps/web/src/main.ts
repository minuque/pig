import { createApp } from "vue"
import { disableKatex, enableMermaid, setMermaidWorker } from "markstream-vue"
import MermaidWorker from "markstream-vue/workers/mermaidParser.worker?worker&inline"

import "@style/app.css"

import App from "./App.vue"
import router from "@router/index.js"

enableMermaid()

disableKatex()

setMermaidWorker(new MermaidWorker())

const app = createApp(App)

app.use(router)

app.mount("#app")
