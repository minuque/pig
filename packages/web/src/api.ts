export interface WorkspaceDto {
  id: string;
  name: string;
  canonicalPath: string;
}

export interface SessionDto {
  id: string;
  workspaceId: string;
  name?: string;
  status: "available" | "unavailable";
  updatedAt: string;
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly requestId: string,
  ) {
    super(code);
  }
}

let credential = "";

export async function bootstrapFromFragment(): Promise<void> {
  const hash = new URLSearchParams(location.hash.slice(1));
  const secret = hash.get("bootstrap");
  if (!secret) return;
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  const response = await fetch("/api/v1/bootstrap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret }),
  });
  if (!response.ok) throw new ApiError("INVALID_BOOTSTRAP", crypto.randomUUID());
  credential = ((await response.json()) as { credential: string }).credential;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const requestId = crypto.randomUUID();
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      authorization: `Bearer ${credential}`,
      "x-request-id": requestId,
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { code?: string };
    throw new ApiError(body.code ?? `HTTP_${response.status}`, requestId);
  }
  return response.json() as Promise<T>;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError)
    return `请求失败（${error.code}）。请重试；如仍失败，请提供关联 ID ${error.requestId}。`;
  return "请求失败。请检查本地 Gateway 后重试。";
}
