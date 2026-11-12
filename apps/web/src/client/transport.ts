/** 本机 Gateway 的 WebSocket 地址：Gateway 在 `GET /api/v1/pi` 收 JSON 文本帧。 */
import { t } from "@i18n/index.js"

// 与 gateway 端 packages/gateway/src/server/websocket.ts 的 WEBSOCKET_PATH 必须一致。
export const WEBSOCKET_PATH = "/api/v1/pi"

function stampedGatewayOrigin(): string | undefined {
  if (typeof document === "undefined") return undefined
  const value = document.documentElement.dataset.pigGatewayOrigin

  if (!value) return undefined

  try {
    const url = new URL(value)

    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") return undefined
    return url.origin
  } catch {
    return undefined
  }
}

/**
 * 组装本机 Gateway WebSocket URL。
 * 开发态走页面同源，由 Vite 转到 Gateway。
 * 桌面壳页 origin 是 pig://app，必须用注入的 Gateway 地址。
 */
export function webSocketUrl(base?: string | URL): string {
  const resolved =
    base ?? import.meta.env.VITE_GATEWAY_TARGET ?? stampedGatewayOrigin() ?? window.location.href
  const url = new URL(WEBSOCKET_PATH, resolved)

  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:" &&
    url.protocol !== "ws:" &&
    url.protocol !== "wss:"
  ) {
    throw new Error(t("errors.wsNeedGateway"))
  }

  url.protocol = url.protocol === "https:" || url.protocol === "wss:" ? "wss:" : "ws:"
  return url.href
}
