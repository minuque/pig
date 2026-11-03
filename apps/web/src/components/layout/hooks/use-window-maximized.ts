import { readonly, ref } from "vue"

/**
 * 窗口最大化状态：桌面壳推事件，页面写 html[data-maximized] 给布局用。
 * 全应用只需一份订阅，模块级共享，不随组件卸载断开。
 */
const maximized = ref(false)
let started = false

/** 最大化只在布局上关掉外沿留白，属性用 on/缺省两态。 */
function stamp(value: boolean): void {
  if (value) document.documentElement.dataset.maximized = "on"
  else delete document.documentElement.dataset.maximized
}

function start(): void {
  const bridge = window.pigDesktop?.window

  if (!bridge) return

  void bridge.isMaximized().then((value) => {
    maximized.value = value
    stamp(value)
  })
  bridge.onMaximizedChange((value) => {
    maximized.value = value
    stamp(value)
  })
}

export function useWindowMaximized() {
  if (!started) {
    started = true
    start()
  }

  return readonly(maximized)
}
