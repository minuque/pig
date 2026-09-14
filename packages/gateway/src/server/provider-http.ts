import { SettingsManager } from "@earendil-works/pi-coding-agent"
import { EnvHttpProxyAgent, install, setGlobalDispatcher, type Dispatcher } from "undici"

const LOOPBACK_NO_PROXY = "127.0.0.1,localhost,::1"

let installed: Dispatcher | undefined

function noProxy(): string {
  const fromEnv = process.env.NO_PROXY ?? process.env.no_proxy ?? ""
  return [fromEnv, LOOPBACK_NO_PROXY].filter((item) => item.length > 0).join(",")
}

/** 与 Pi CLI 一样走 HTTPS_PROXY；直连 api.x.ai 在污染 DNS 上会 10s 连超时。 */
export function installProviderHttp(cwd = process.cwd()): void {
  if (installed) return

  const timeoutMs = SettingsManager.create(cwd).getHttpIdleTimeoutMs()

  const dispatcher = new EnvHttpProxyAgent({
    allowH2: false,
    bodyTimeout: timeoutMs,
    headersTimeout: timeoutMs,
    connect: { autoSelectFamilyAttemptTimeout: 2_000 },
    noProxy: noProxy(),
  })

  setGlobalDispatcher(dispatcher)
  install?.()
  installed = dispatcher
}

export function providerHttpInstalled(): boolean {
  return installed !== undefined
}
