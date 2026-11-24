import { Comment, Fragment, h, Text, type Slots, type VNode } from "vue"

export interface PartSlots {
  default?: () => VNode[]
  render?: (scope: { props: Record<string, unknown> }) => VNode[]
}

function firstElement(nodes: unknown): VNode | undefined {
  if (!Array.isArray(nodes)) return undefined

  for (const node of nodes as VNode[]) {
    if (node.type === Comment || node.type === Text) continue

    if (node.type !== Fragment) return node

    const inner = firstElement(node.children)

    if (inner) return inner
  }

  return undefined
}

export function renderPart(slots: Slots, tag: string, props: Record<string, unknown>) {
  return firstElement(slots["render"]?.({ props })) ?? h(tag, props, slots["default"]?.())
}
