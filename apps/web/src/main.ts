import { createApp } from "vue";
import { enableMermaid } from "markstream-vue";
import { applyDesktopPresentationMarker } from "./desktop-marker.js";
import "@app/reset.css";
import "@app/app.css";
import App from "@app/App.vue";
import router from "@router/index.js";

enableMermaid();

applyDesktopPresentationMarker(window.location.href, document.documentElement);

const app = createApp(App);
app.use(router);
app.mount("#app");
