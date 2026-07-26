import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "@/App.vue";
import { captureBootstrapSecret } from "@/lib/gateway/bootstrap-secret";
import { createGatewayClient } from "@/lib/gateway/client";
import { provideGatewayClient } from "@/lib/gateway/client-context";
import { createAppRouter } from "@/router";
import { useTheme } from "@/theme/use-theme";
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
