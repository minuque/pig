import { createApp } from "vue"

import "@style/app.css"

import App from "./App.vue"
import router from "@router/index.js"
import { useGeneralPrefs } from "@features/settings/index.js"
import { i18n } from "@i18n/index.js"

useGeneralPrefs()

const app = createApp(App)

app.use(router)

app.use(i18n)

app.mount("#app")
