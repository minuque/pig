// 不向 renderer 暴露 API。html 解析会换掉根节点，DOMContentLoaded 再写一次。
const GATEWAY_ORIGIN_ARG_PREFIX = "--pig-gateway-origin="

function stampDesktopPlatform() {
  const platform = process.platform
  if (platform !== "darwin" && platform !== "win32" && platform !== "linux") return
  document.documentElement.dataset.pigDesktopPlatform = platform
}

function stampGatewayOrigin() {
  const arg = process.argv.find((item) => item.startsWith(GATEWAY_ORIGIN_ARG_PREFIX))
  if (!arg) return
  try {
    const url = new URL(arg.slice(GATEWAY_ORIGIN_ARG_PREFIX.length))
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") return
    document.documentElement.dataset.pigGatewayOrigin = url.origin
  } catch {
    /* 非法参数忽略 */
  }
}

function stamp() {
  stampDesktopPlatform()
  stampGatewayOrigin()
}

stamp()
document.addEventListener("DOMContentLoaded", stamp)
