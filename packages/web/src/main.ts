import { createApp } from "vue";
import "./app/reset.css";
import "./app/app.css";
import "markstream-vue/index.css";
import App from "./app/App.vue";
import router from "./router/index.js";

const app = createApp(App);
app.use(router);
app.mount("#app");
