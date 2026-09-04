// 不向 renderer 暴露 API。启动时打桌面平台标记，不靠 URL。
const platform = process.platform
if (platform === "darwin" || platform === "win32" || platform === "linux") {
  document.documentElement.dataset.pigDesktopPlatform = platform
}
