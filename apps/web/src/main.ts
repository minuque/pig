import { createApp } from "vue"
import { disableKatex } from "markstream-vue"

import "@style/app.css"

import App from "./App.vue"
import router from "@router/index.js"

disableKatex()

const app = createApp(App)

app.use(router)

app.mount("#app")
