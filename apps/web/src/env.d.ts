/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GATEWAY_TARGET?: string
  readonly VITE_BOOTSTRAP_SECRET?: string
}

declare module "*.css"
declare module "*.svg?url" {
  const src: string
  export default src
}
