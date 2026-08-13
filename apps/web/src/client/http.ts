/**
 * Browser 平台 HTTP 层：启动授权（bootstrap）、凭证存取与带凭证请求。
 * 旧 REST/SSE client 已随 UI 接入官方远程栈删除，本模块仅剩启动授权与目录选择请求。
 */

const CREDENTIAL_KEY = "pig.credential";
const BOOTSTRAP_PATH = "/api/v1/bootstrap";

export class PlatformRequestError extends Error {
  constructor(
    readonly code: string,
    readonly requestId: string,
  ) {
    super(code);
  }
}

export function restoreCredential(): string {
  try {
    return typeof localStorage === "undefined" ? "" : (localStorage.getItem(CREDENTIAL_KEY) ?? "");
  } catch {
    return "";
  }
}

export function persistCredential(value: string): void {
  try {
    localStorage?.setItem(CREDENTIAL_KEY, value);
  } catch {
    /* 隐私模式等场景下存储不可用，凭证仅存活于本页 */
  }
}

/** 从 `#bootstrap=<secret>` 片段兑换本地服务凭证；无片段时不执行任何操作。 */
export async function bootstrapFromUrl(): Promise<void> {
  const hash = new URLSearchParams(location.hash.slice(1));
  const secret = hash.get("bootstrap");
  if (!secret) return;

  const response = await fetch(BOOTSTRAP_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret }),
  });
  if (!response.ok) throw new PlatformRequestError("INVALID_BOOTSTRAP", crypto.randomUUID());
  const { credential } = (await response.json()) as { credential: string };
  persistCredential(credential);
  history.replaceState(null, "", `${location.pathname}${location.search}`);
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

export function errorMessage(error: unknown): string {
  if (error instanceof PlatformRequestError) {
    if (error.code === "UNAUTHENTICATED")
      return `本地服务凭证已失效（可能已重启）。请重新打开启动链接完成授权。`;
    return `请求失败（${error.code}）。请重试；如仍失败，请提供关联 ID ${error.requestId}。`;
  }
  return "请求失败。请检查本地服务后重试。";
}
