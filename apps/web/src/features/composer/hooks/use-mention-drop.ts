import { ref } from "vue"
import { COMPOSER_MENTION_MIME } from "@features/composer/lib/composer-trigger.js"

export function useMentionDrop(insert: (markdown: string) => void) {
  const over = ref(false)

  function claim(event: DragEvent): DataTransfer | undefined {
    const data = event.dataTransfer

    if (!data?.types.includes(COMPOSER_MENTION_MIME)) return undefined
    event.preventDefault()
    event.stopPropagation()
    data.dropEffect = "copy"
    return data
  }

  function onDrag(event: DragEvent) {
    if (claim(event)) over.value = true
  }

  function onLeave(event: DragEvent) {
    const box = event.currentTarget

    if (
      box instanceof Node &&
      event.relatedTarget instanceof Node &&
      box.contains(event.relatedTarget)
    )
      return
    over.value = false
  }

  function onDrop(event: DragEvent) {
    const data = claim(event)

    if (!data) return
    over.value = false
    const markdown = data.getData(COMPOSER_MENTION_MIME)

    if (markdown) insert(markdown)
  }

  return { over, onDrag, onLeave, onDrop }
}
