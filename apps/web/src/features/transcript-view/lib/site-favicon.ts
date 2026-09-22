const statusCache = new Map<string, "ok" | "fail">()
const inFlight = new Map<string, Promise<"ok" | "fail">>()

/** 站点自己的 /favicon.ico。同一主机只请求一次。 */
export function siteFaviconSrc(url: string): string | null {
  try {
    const parsed = new URL(url)

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null

    if (!parsed.hostname) return null
    return `${parsed.origin}/favicon.ico`
  } catch {
    return null
  }
}

export function markSiteFaviconFailed(src: string): void {
  statusCache.set(src, "fail")
}

/** 用 Image 预检，避免把裂图画进链接里。结果按地址缓存。 */
export function probeSiteFavicon(src: string): Promise<"ok" | "fail"> {
  const cached = statusCache.get(src)

  if (cached) return Promise.resolve(cached)
  const pending = inFlight.get(src)

  if (pending) return pending

  const promise = new Promise<"ok" | "fail">((resolve) => {
    const image = new Image()

    image.onload = () => resolve("ok")
    image.onerror = () => resolve("fail")
    image.src = src
  }).then((status) => {
    statusCache.set(src, status)
    inFlight.delete(src)
    return status
  })

  inFlight.set(src, promise)
  return promise
}
