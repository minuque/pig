import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath, URL } from "node:url"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import vueDevTools from "vite-plugin-vue-devtools"

const gatewayTarget = process.env.GATEWAY_TARGET
// 给客户端：Pi WebSocket 直连 Gateway，不经 Vite 的 WS 代理
if (gatewayTarget) process.env.VITE_GATEWAY_TARGET = gatewayTarget

export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // markstream / shiki 主包超过 Workbox 默认 2 MiB，不抬上限则 vite build 失败
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      manifest: {
        name: "pig",
        short_name: "pig",
        description: "基于 Pi 的本地 Agent GUI",
        lang: "zh-CN",
        theme_color: "#637cd2",
        background_color: "#fafafb",
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
          // 只反代 HTTP。WS 直连 Gateway，避免 Vite 代理把 upgrade 当普通 HTTP 回写。
          proxy: { "/api": { target: gatewayTarget, changeOrigin: true } },
        }
      : {}),
  },
})
