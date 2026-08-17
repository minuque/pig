import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import vueDevTools from "vite-plugin-vue-devtools";

const gatewayTarget = process.env.GATEWAY_TARGET;
const bootstrapSecret = process.env.BOOTSTRAP_SECRET;
// 给客户端：Pi WebSocket 直连 Gateway，不经 Vite 的 WS 代理
if (gatewayTarget) process.env.VITE_GATEWAY_TARGET = gatewayTarget;
// dev 下暴露 bootstrap secret，无凭证访问时自动跳转启动链接完成授权
if (bootstrapSecret) process.env.VITE_BOOTSTRAP_SECRET = bootstrapSecret;

export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // markstream / mermaid / shiki 主包超过 Workbox 默认 2 MiB，不抬上限则 vite build 失败
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      manifest: {
        name: "pig",
        short_name: "pig",
        description: "",
        lang: "zh-CN",
        theme_color: "#18181b",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "/pwa-icon-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/pwa-icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@style": fileURLToPath(new URL("./src/style", import.meta.url)),
      "@components": fileURLToPath(new URL("./src/components", import.meta.url)),
      "@features": fileURLToPath(new URL("./src/features", import.meta.url)),
      "@client": fileURLToPath(new URL("./src/client", import.meta.url)),
      "@router": fileURLToPath(new URL("./src/router", import.meta.url)),
      "@utils": fileURLToPath(new URL("./src/utils", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    // 固定端口,方便 VSCode Chrome 调试;strictPort 防止被静默换端口后断点失效
    port: 5173,
    strictPort: true,
    open: false,
    ...(gatewayTarget
      ? {
          // 只反代 HTTP。ws:true 时 Gateway 对未授权 upgrade 回 401，
          // Vite/http-proxy 会当普通 HTTP 回写，Windows 上变成 write ECONNABORTED。
          proxy: { "/api": { target: gatewayTarget, changeOrigin: true } },
        }
      : {}),
  },
});
