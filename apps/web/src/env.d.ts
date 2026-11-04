/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_GATEWAY_TARGET?: string
}

declare module "*.css"

declare module "*.svg?url" {
  const src: string
  export default src
}

interface Window {
  /** 桌面壳 preload 注入。浏览器里没有。 */
  pigDesktop?: {
    setThemeColor(color: string): void
    /** 半透明窗口：交给系统背景材质，页面只留出透明区域。 */
    setTranslucent(on: boolean): void
  }
}
