/**
 * Browser 平台 HTTP：JSON 请求与错误文案。
 */

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
  if (!(error instanceof PlatformRequestError)) return "请求失败。请检查本地服务后重试。"
  return `请求失败（${error.code}）。请重试；如仍失败，请提供关联 ID ${error.requestId}。`
}
