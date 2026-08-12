import { randomUUID } from "node:crypto";

/**
 * 本地启动认证：一次性 bootstrap secret 兑换 WebSocket credential。
 * 认证属于 transport security；浏览器无法自定义 header，credential 经查询参数传递。
 */
export class BootstrapAuth {
  private readonly credentials = new Set<string>();
  private bootstrapUsed = false;

  constructor(
    private readonly secret: string,
    private readonly ttlMs: number,
    private readonly expiresAt = Date.now() + ttlMs,
  ) {}

  /** 用 secret 兑换一次性 credential；secret 错误、重复使用或过期返回 undefined。 */
  exchange(secret: string): string | undefined {
    if (this.bootstrapUsed || Date.now() >= this.expiresAt || secret !== this.secret) {
      return undefined;
    }
    this.bootstrapUsed = true;
    const credential = randomUUID();
    this.credentials.add(credential);
    return credential;
  }

  verify(credential: string | undefined): boolean {
    return credential !== undefined && this.credentials.has(credential);
  }
}
