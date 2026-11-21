/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import vueDevTools from "vite-plugin-vue-devtools"

import { maxWorkers } from "../../vitest.workers.mjs"

const gatewayTarget = process.env.GATEWAY_TARGET
const gatewayToken = process.env.GATEWAY_TOKEN

export default defineConfig({
  plugins: [
    vue(),
    // 外部：vitest 下加载 devtools 会在插件卸载后留下 unhandled rejection
    ...(process.env.VITEST || process.env.PIG_DESKTOP_DEV ? [] : [vueDevTools()]),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "script-defer",
      workbox: {
        globPatterns: [
          "index.html",
          "assets/index-*.{js,css}",
          "assets/WorkbenchShell-*.{js,css}",
          "pwa-icon-*.png",
        ],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
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
      "@i18n": fileURLToPath(new URL("./src/i18n", import.meta.url)),
      "@utils": fileURLToPath(new URL("./src/utils", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5555,
    strictPort: true,
    open: false,
    ...(gatewayTarget
      ? {
          proxy: {
            "/api": {
              target: gatewayTarget,
              changeOrigin: true,
              ws: true,
              configure: (proxy) => {
                const stamp = (proxyReq: { setHeader(name: string, value: string): void }) => {
                  if (gatewayToken) proxyReq.setHeader("authorization", `Bearer ${gatewayToken}`)
                }

                proxy.on("proxyReq", stamp)
                proxy.on("proxyReqWs", stamp)
              },
            },
          },
        }
      : {}),
  },
  test: {
    maxWorkers,
    coverage: {
      reporter: ["text", "html"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          setupFiles: ["./test/setup.ts"],
        },
      },
    ],
  },
})
