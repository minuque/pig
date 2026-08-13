import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const gatewayTarget = process.env.GATEWAY_TARGET;
const bootstrapSecret = process.env.BOOTSTRAP_SECRET;

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    // 固定端口,方便 VSCode Chrome 调试;strictPort 防止被静默换端口后断点失效
    port: 5173,
    strictPort: true,
    open: bootstrapSecret ? `/#bootstrap=${encodeURIComponent(bootstrapSecret)}` : false,
    ...(gatewayTarget ? { proxy: { "/api": { target: gatewayTarget } } } : {}),
  },
});
