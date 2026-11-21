import { t } from "@i18n/index.js"

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
