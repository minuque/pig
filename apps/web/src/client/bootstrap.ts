/**
 * 启动授权：从 `#bootstrap=<secret>` 兑换凭证，并读写 localStorage 中的凭证。
 */
const CREDENTIAL_KEY = "pig.credential";
const BOOTSTRAP_PATH = "/api/v1/bootstrap";

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

function clearBootstrapHash(): void {
  if (!new URLSearchParams(location.hash.slice(1)).has("bootstrap")) return;
  history.replaceState(null, "", `${location.pathname}${location.search}`);
}

/** 从 `#bootstrap=<secret>` 片段兑换本地服务凭证；无片段时不执行任何操作。 */
export async function bootstrapFromUrl(): Promise<void> {
  const hash = new URLSearchParams(location.hash.slice(1));
  // dev 下无 `#bootstrap` hash 时用注入的 secret 自动授权，避免直接打开 5173 报"请求失败"
  const secret =
    hash.get("bootstrap") ??
    (import.meta.env.DEV ? import.meta.env.VITE_BOOTSTRAP_SECRET : undefined) ??
    null;
  if (!secret) return;

  const response = await fetch(BOOTSTRAP_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret }),
  });
  if (!response.ok) {
    // secret 错误或 Gateway 已重启时兑换会 401。
    // 已有凭证则清掉过期 hash，沿用 localStorage，避免把整页打成 INVALID_BOOTSTRAP。
    if (restoreCredential()) {
      clearBootstrapHash();
      return;
    }
    throw Object.assign(new Error("INVALID_BOOTSTRAP"), {
      code: "INVALID_BOOTSTRAP",
      requestId: crypto.randomUUID(),
    });
  }
  const { credential } = (await response.json()) as { credential: string };
  persistCredential(credential);
  clearBootstrapHash();
}
