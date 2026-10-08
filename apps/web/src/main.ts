import { createApp } from "vue"
import { disableKatex } from "markstream-vue"

import "@style/app.css"

import App from "./App.vue"
import router from "@router/index.js"
import { useGeneralPrefs } from "@features/settings/index.js"

disableKatex()

useGeneralPrefs()

const app = createApp(App)

app.use(router)

app.mount("#app")
