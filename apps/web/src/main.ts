import { createApp } from "vue";
import { disableMermaid } from "markstream-vue";
import { applyDesktopPresentationMarker } from "./desktop-marker.js";
import "@style/reset.css";
import "@style/app.css";
import App from "./App.vue";
import router from "@router/index.js";

applyDesktopPresentationMarker(window.location.href, document.documentElement);
disableMermaid();

const app = createApp(App);
app.use(router);
app.mount("#app");
