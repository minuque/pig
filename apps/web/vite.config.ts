/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath, URL } from "node:url"
import path from "node:path"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import vueDevTools from "vite-plugin-vue-devtools"
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import { playwright } from "@vitest/browser-playwright"

const dirname = import.meta.dirname
// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
const gatewayTarget = process.env.GATEWAY_TARGET
const gatewayToken = process.env.GATEWAY_TOKEN

export default defineConfig({
  plugins: [
    vue(),
    // vitest 的浏览器测试在故事卸载后会被 devtools 的 activeAppRecord 拖出 unhandled rejection
    ...(process.env.VITEST ? [] : [vueDevTools()]),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "script-defer",
      workbox: {
        globPatterns: [
          "index.html",
          "assets/index-*.{js,css}",
          "assets/session-workbench-*.{js,css}",
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
    // 固定端口,方便 VSCode Chrome 调试;strictPort 防止被静默换端口后断点失效
    port: 5555,
    strictPort: true,
    open: false,
    ...(gatewayTarget
      ? {
          // 页面和 Gateway 不同源。代理补上本进程的启动凭证，浏览器不必保存它。
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
    // 故事只跑基础组件，统计范围限定在这一层；app 整体覆盖率用 --coverage.include 覆盖
    coverage: {
      include: ["src/components/ui/**/*.{ts,vue}"],
      exclude: ["src/**/*.stories.ts"],
      reporter: ["text", "html"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          // node 环境没有 localStorage；偏好读写默认参数直接引用它
          setupFiles: ["./test/setup.ts"],
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [
              {
                browser: "chromium",
              },
            ],
          },
        },
      },
    ],
  },
})
