import { ref, toValue, watch, type WatchSource } from "vue"

/** 分区折叠：收起播完过渡再卸内容，展开先挂载再开闸；rAF 被节流时用短超时兜底开闸。 */
export function useSectionFold(collapsed: WatchSource<boolean>) {
  const open = ref(!toValue(collapsed))
  const mounted = ref(true)
  let timer = 0

  watch(collapsed, (next) => {
    window.clearTimeout(timer)

    if (next) {
      open.value = false
      // 收起走 --duration-fast（150ms）；余量兜底 reduced-motion 无过渡的场景
      timer = window.setTimeout(() => (mounted.value = false), 220)
      return
    }

    mounted.value = true
    // 等浏览器按 0fr 算一次样式，过渡才有起点
    requestAnimationFrame(() => (open.value = true))
    timer = window.setTimeout(() => (open.value = true), 120)
  })
  return { open, mounted }
}
