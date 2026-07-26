import { createApp } from "vue";
import { createPinia } from "pinia";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import App from "@/App.vue";
import { createAppRouter } from "@/router";
import { createGatewayClient } from "@/lib/gateway/client";
import { provideGatewayClient } from "@/lib/gateway/client-context";
import { useTheme } from "@/theme/use-theme";
import { captureBootstrapSecret } from "@/lib/gateway/bootstrap-secret";
import "@/styles/tokens.css";
import "@/styles/base.css";

captureBootstrapSecret();

const app = createApp(App);

app.use(createPinia());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5_000,
    },
  },
});
app.use(VueQueryPlugin, { queryClient });

app.use(createAppRouter());
provideGatewayClient(app, createGatewayClient());
useTheme();

app.mount("#app");
