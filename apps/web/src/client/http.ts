/**
 * Browser 平台 HTTP：带凭证请求与错误文案。
 * 启动授权见 bootstrap.ts。
 */
import { restoreCredential } from "@client/bootstrap.js";

export class PlatformRequestError extends Error {
  constructor(
    readonly code: string,
    readonly requestId: string,
  ) {
    super(code);
  }
}

/** 带凭证的 JSON 请求；非 2xx 时抛出 PlatformRequestError。 */
export async function platformRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const requestId = crypto.randomUUID();
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      authorization: `Bearer ${restoreCredential()}`,
      "x-request-id": requestId,
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { code?: string };
    throw new PlatformRequestError(body.code ?? `HTTP_${response.status}`, requestId);
  }
  return response.json() as Promise<T>;
}

function requestFailure(error: unknown): { code: string; requestId: string } | undefined {
  if (error instanceof PlatformRequestError) return error;
  if (
    error instanceof Error &&
    "code" in error &&
    "requestId" in error &&
    typeof error.code === "string" &&
    typeof error.requestId === "string"
  ) {
    return { code: error.code, requestId: error.requestId };
  }
}

export function errorMessage(error: unknown): string {
  const failure = requestFailure(error);
  if (!failure) return "请求失败。请检查本地服务后重试。";
  if (failure.code === "UNAUTHENTICATED")
    return `本地服务凭证已失效（可能已重启）。请重新打开启动链接完成授权。`;
  return `请求失败（${failure.code}）。请重试；如仍失败，请提供关联 ID ${failure.requestId}。`;
}
