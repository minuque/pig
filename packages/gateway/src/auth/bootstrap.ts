import { randomUUID } from "node:crypto";

/** credential 有效期：覆盖单次本地启动会话即可。 */
const CREDENTIAL_TTL_MS = 24 * 60 * 60 * 1_000;

/**
 * 本地启动认证：一次性 bootstrap secret 兑换 WebSocket credential。
 * 认证属于 transport security；浏览器无法自定义 header，credential 经查询参数传递。
 * 兑换只发生一次，凭证只需单个字段。
 */
export class BootstrapAuth {
  private readonly expiresAt: number;
  private credential: string | undefined;
  private credentialExpiresAt = 0;

  constructor(
    private readonly secret: string,
    private readonly ttlMs: number,
  ) {
    this.expiresAt = Date.now() + ttlMs;
  }

  /** 用 secret 兑换一次性 credential；secret 错误、重复使用或过期返回 undefined。 */
  exchange(secret: string): string | undefined {
    if (this.credential || Date.now() >= this.expiresAt || secret !== this.secret) {
      return undefined;
    }
    this.credential = randomUUID();
    this.credentialExpiresAt = Date.now() + CREDENTIAL_TTL_MS;
    return this.credential;
  }

  verify(credential: string | undefined): boolean {
    return (
      credential !== undefined &&
      credential === this.credential &&
      this.credentialExpiresAt > Date.now()
    );
  }
}
