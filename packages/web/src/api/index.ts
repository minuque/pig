export type { WorkspaceDto } from "../features/workspaces/types.js";
export type { SessionDto } from "../features/sessions/types.js";

import type { SSEEventEnvelope } from "@no-pi-no-gang/contracts";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly requestId: string,
  ) {
    super(code);
  }
}

const CREDENTIAL_KEY = "no-pi-no-gang.credential";
let credential = restoreCredential();

function restoreCredential(): string {
  try {
    return typeof sessionStorage === "undefined"
      ? ""
      : (sessionStorage.getItem(CREDENTIAL_KEY) ?? "");
  } catch {
    return "";
  }
}
function persistCredential(value: string) {
  try {
    sessionStorage?.setItem(CREDENTIAL_KEY, value);
  } catch {
    /* 隐私模式等场景下存储不可用，凭证仅存活于本页 */
  }
}

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
  persistCredential(credential);
}

export async function streamEvents(
  onEvent: (event: unknown) => void,
  signal: AbortSignal,
  onOpen: (info: { gap: boolean; latestSequence?: number | undefined }) => void = () => undefined,
  lastEventId?: number,
): Promise<{ gap: boolean; latestSequence: number | undefined }> {
  const headers: HeadersInit = {
    authorization: `Bearer ${credential}`,
  };
  if (lastEventId !== undefined) {
    headers["Last-Event-ID"] = lastEventId.toString();
  }
  const response = await fetch("/api/v1/events", {
    headers,
    signal,
  });
  if (!response.ok || !response.body)
    throw new ApiError(`HTTP_${response.status}`, crypto.randomUUID());
  const gap = response.headers.get("X-Event-Stream-Gap") === "1";
  let latestSequence: number | undefined = undefined;
  onOpen({ gap, latestSequence });
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) return { gap, latestSequence };
    buffer += value;
    const messages = buffer.split("\n\n");
    buffer = messages.pop() ?? "";
    for (const message of messages) {
      const data = message.split("\n").find((line) => line.startsWith("data: "));
      if (data) {
        const envelope = JSON.parse(data.slice(6)) as SSEEventEnvelope;
        onEvent(envelope);
        if (latestSequence === undefined || envelope.sequence > latestSequence) {
          latestSequence = envelope.sequence;
        }
      }
    }
  }
  return { gap, latestSequence };
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
  if (error instanceof ApiError) {
    if (error.code === "UNAUTHENTICATED")
      return `本地 Gateway 凭证已失效（可能已重启）。请重新打开 Gateway 的启动链接完成授权。`;
    return `请求失败（${error.code}）。请重试；如仍失败，请提供关联 ID ${error.requestId}。`;
  }
  return "请求失败。请检查本地 Gateway 后重试。";
}
