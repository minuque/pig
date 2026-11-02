/** 外部链接交给系统浏览器：桌面壳里新开窗口会变成第二个 Electron 窗口。 */

export type ExternalLinkContents = {
  setWindowOpenHandler(handler: (details: { url: string }) => { action: "deny" }): void
  on(
    event: "will-navigate",
    handler: (event: { preventDefault(): void }, url: string) => void,
  ): void
  getURL(): string
}

export function installExternalLinks(
  contents: ExternalLinkContents,
  openExternal: (url: string) => void,
): void {
  contents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) openExternal(url)
    return { action: "deny" }
  })

  contents.on("will-navigate", (event, url) => {
    if (!isHttpUrl(url) || sameOrigin(url, contents.getURL())) return
    event.preventDefault()
    openExternal(url)
  })
}

function isHttpUrl(url: string): boolean {
  const protocol = protocolOf(url)
  return protocol === "http:" || protocol === "https:"
}

function sameOrigin(left: string, right: string): boolean {
  try {
    return new URL(left).origin === new URL(right).origin
  } catch {
    return false
  }
}

function protocolOf(url: string): string | undefined {
  try {
    return new URL(url).protocol
  } catch {
    return undefined
  }
}
