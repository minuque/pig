/**
 * Browser 平台 HTTP：JSON 请求与错误文案。
 */

import { t } from "@i18n/index.js"

export class PlatformRequestError extends Error {
  constructor(
    readonly code: string,
    readonly requestId: string,
  ) {
    super(code)
  }
}

/** JSON 请求；非 2xx 时抛出 PlatformRequestError。 */
export async function platformRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const requestId = crypto.randomUUID()
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      "x-request-id": requestId,
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { code?: string }
    throw new PlatformRequestError(body.code ?? `HTTP_${response.status}`, requestId)
  }

  return response.json() as Promise<T>
}

export function errorMessage(error: unknown): string {
  if (!(error instanceof PlatformRequestError)) return t("errors.requestFailed")
  return t("errors.requestFailedDetail", { code: error.code, id: error.requestId })
}
