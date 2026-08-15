import { randomUUID } from "node:crypto";

/** credential 有效期：覆盖单次本地启动会话即可。 */
const CREDENTIAL_TTL_MS = 24 * 60 * 60 * 1_000;

/**
 * 本地启动认证：bootstrap secret 兑换 WebSocket credential。
 * 认证属于 transport security；浏览器无法自定义 header，credential 经查询参数传递。
 * 同一 secret 在过期前重复兑换返回同一凭证，方便默认浏览器与调试 Chrome 共用启动链接。
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

  /** 用 secret 兑换 credential；错误或过期返回 undefined。已兑换则原样返回。 */
  exchange(secret: string): string | undefined {
    if (secret !== this.secret || Date.now() >= this.expiresAt) return undefined;
    if (this.credential && this.credentialExpiresAt > Date.now()) return this.credential;
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
