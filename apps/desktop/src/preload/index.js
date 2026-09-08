// 不向 renderer 暴露 API。html 解析会换掉根节点，DOMContentLoaded 再写一次。
function stampDesktopPlatform() {
  const platform = process.platform
  if (platform !== "darwin" && platform !== "win32" && platform !== "linux") return
  document.documentElement.dataset.pigDesktopPlatform = platform
}

stampDesktopPlatform()
document.addEventListener("DOMContentLoaded", stampDesktopPlatform)
