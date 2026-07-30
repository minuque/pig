import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const gatewayTarget = process.env.GATEWAY_TARGET;
const bootstrapSecret = process.env.BOOTSTRAP_SECRET;

export default defineConfig({
  plugins: [vue()],
  server: {
    host: "127.0.0.1",
    port: 0,
    open: bootstrapSecret ? `/#bootstrap=${encodeURIComponent(bootstrapSecret)}` : false,
    ...(gatewayTarget ? { proxy: { "/api": { target: gatewayTarget } } } : {}),
  },
});
