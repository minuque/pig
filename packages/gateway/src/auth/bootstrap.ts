import { randomUUID } from "node:crypto";

/**
 * 本地启动认证：一次性 bootstrap secret 兑换 WebSocket credential。
 * 认证属于 transport security；浏览器无法自定义 header，credential 经查询参数传递。
 */
export class BootstrapAuth {
  private readonly credentials = new Map<string, number>();
  private bootstrapUsed = false;

  constructor(
    private readonly secret: string,
    private readonly ttlMs: number,
    private readonly expiresAt = Date.now() + ttlMs,
    private readonly credentialTtlMs = 24 * 60 * 60 * 1_000,
    private readonly maxCredentials = 16,
  ) {}

  /** 用 secret 兑换一次性 credential；secret 错误、重复使用或过期返回 undefined。 */
  exchange(secret: string): string | undefined {
    if (this.bootstrapUsed || Date.now() >= this.expiresAt || secret !== this.secret) {
      return undefined;
    }
    this.bootstrapUsed = true;
    const credential = randomUUID();
    const now = Date.now();
    for (const [value, expiresAt] of this.credentials) {
      if (expiresAt <= now) this.credentials.delete(value);
    }
    while (this.credentials.size >= this.maxCredentials) {
      this.credentials.delete(this.credentials.keys().next().value as string);
    }
    this.credentials.set(credential, now + this.credentialTtlMs);
    return credential;
  }

  verify(credential: string | undefined): boolean {
    if (!credential) return false;
    const expiresAt = this.credentials.get(credential);
    if (expiresAt === undefined) return false;
    if (expiresAt > Date.now()) return true;
    this.credentials.delete(credential);
    return false;
  }
}
