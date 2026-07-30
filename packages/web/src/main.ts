import { createApp } from "vue";
import "./reset.css";
import "markstream-vue/index.css";
import App from "./App.vue";
import router from "./router/index.js";

const app = createApp(App);
app.use(router);
app.mount("#app");
