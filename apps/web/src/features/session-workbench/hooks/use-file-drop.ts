import { useEventListener } from "@vueuse/core"
import { ref } from "vue"

function looksLikeFileDrag(event: DragEvent): boolean {
  const data = event.dataTransfer

  if (!data) return false
  const types = Array.from(data.types)

  if (types.includes("Files") || types.includes("application/x-moz-file")) return true

  if (Array.from(data.items).some((item) => item.kind === "file")) return true
  // Windows 资源管理器在进入窗口前 types 经常是空的
  return types.length === 0
}

function claimFileDrag(event: DragEvent): boolean {
  if (!looksLikeFileDrag(event)) return false
  event.preventDefault()

  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy"
  return true
}

/** 指针仍在元素内：dragleave 在子元素之间穿梭时也会触发。 */
function stillInside(event: DragEvent): boolean {
  const node = event.currentTarget

  if (!(node instanceof HTMLElement)) return false
  const to = event.relatedTarget

  if (to instanceof Node && node.contains(to)) return true

  if (to) return false
  const box = node.getBoundingClientRect()
  const x = event.clientX
  const y = event.clientY
  return x > box.left && x < box.right && y > box.top && y < box.bottom
}

/** 面板内拖文件：高亮与落点交回调用方，窗口级默认行为一律拦下。 */
export function useFileDrop(addDropped: (data: DataTransfer | null) => void) {
  const dropActive = ref(false)

  function onDragEnter(event: DragEvent) {
    if (!claimFileDrag(event)) return
    dropActive.value = true
  }

  function onDragOver(event: DragEvent) {
    if (!claimFileDrag(event)) return
    dropActive.value = true
  }

  function onDragLeave(event: DragEvent) {
    if (stillInside(event)) return
    dropActive.value = false
  }

  function onDrop(event: DragEvent) {
    dropActive.value = false
    event.preventDefault()
    addDropped(event.dataTransfer)
  }

  function onWindowFileDrag(event: DragEvent) {
    claimFileDrag(event)
  }

  function onWindowFileDrop(event: DragEvent) {
    if (!looksLikeFileDrag(event)) return
    event.preventDefault()
  }

  useEventListener(window, "dragenter", onWindowFileDrag, { capture: true })

  useEventListener(window, "dragover", onWindowFileDrag, { capture: true })

  useEventListener(window, "drop", onWindowFileDrop, { capture: true })
  return { dropActive, onDragEnter, onDragOver, onDragLeave, onDrop }
}
