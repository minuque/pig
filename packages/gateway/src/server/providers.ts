import type { IncomingMessage, ServerResponse } from "node:http"

import type { ProviderService } from "../pi/provider-service.js"

export type ProviderRequestDeps = {
  send(res: ServerResponse, status: number, body?: unknown): void
  providers: ProviderService
}

/** /api/v1/platform 下的供应商路由；true=已处理。 */
export async function handleProviderRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps: ProviderRequestDeps,
): Promise<boolean> {
  if (url.pathname === "/api/v1/platform/providers" && req.method === "GET") {
    try {
      deps.send(res, 200, await deps.providers.listProviders())
    } catch (error) {
      console.error("providers failed:", error)
      deps.send(res, 500, { code: "INTERNAL_ERROR" })
    }

    return true
  }

  if (url.pathname === "/api/v1/platform/models" && req.method === "GET") {
    try {
      deps.send(res, 200, await deps.providers.listModels())
    } catch (error) {
      console.error("models failed:", error)
      deps.send(res, 500, { code: "INTERNAL_ERROR" })
    }

    return true
  }

  return false
}
