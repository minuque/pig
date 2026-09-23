import { shallowRef, type Ref } from "vue"

export function useGroupReorder(
  groupRows: Ref<readonly { key: string; canonicalPath: string }[]>,
  reorder: (paths: string[]) => void,
) {
  const dragGroupKey = shallowRef<string | null>(null)
  const dropLine = shallowRef<{ key: string; place: "before" | "after" } | null>(null)

  function clearGroupDrag() {
    dragGroupKey.value = null
    dropLine.value = null
  }

  function onGroupDragStart(key: string, event: DragEvent) {
    dragGroupKey.value = key
    dropLine.value = null
    event.dataTransfer?.setData("text/plain", key)

    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"
  }

  function onGroupDragOver(key: string, event: DragEvent) {
    const from = dragGroupKey.value

    if (!from || from === key) {
      dropLine.value = null
      return
    }

    const row = event.currentTarget

    if (!(row instanceof HTMLElement)) return
    const rect = row.getBoundingClientRect()
    const place = event.clientY < rect.top + rect.height / 2 ? "before" : "after"

    if (dropLine.value?.key === key && dropLine.value.place === place) return
    dropLine.value = { key, place }
  }

  function onGroupDrop(key: string) {
    const from = dragGroupKey.value
    const place = dropLine.value?.key === key ? dropLine.value.place : "before"
    clearGroupDrag()

    if (!from || from === key) return
    const paths = groupRows.value.map((row) => row.canonicalPath)
    const next = paths.filter((path) => path !== from)
    let index = next.indexOf(key)

    if (index < 0) return

    if (place === "after") index += 1
    next.splice(index, 0, from)
    reorder(next)
  }

  return { dropLine, onGroupDragStart, onGroupDragOver, onGroupDrop, clearGroupDrag }
}
