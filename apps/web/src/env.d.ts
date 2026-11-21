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
  pigDesktop?: {
    setThemeColor(color: string): void
    window: {
      minimize(): void
      toggleMaximize(): void
      close(): void
      isMaximized(): Promise<boolean>
      onMaximizedChange(listener: (maximized: boolean) => void): () => void
    }
  }
}
