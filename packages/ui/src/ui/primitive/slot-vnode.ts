import { Comment, Fragment, Text, isVNode, type VNode } from "vue"

export function findSingleVNode(nodes: VNode[] | undefined): VNode | null {
  if (!nodes) return null

  for (const node of nodes) {
    if (!isVNode(node) || node.type === Comment) continue

    if (node.type === Text && typeof node.children === "string" && !node.children.trim()) continue

    if (node.type === Fragment) {
      const nested = Array.isArray(node.children) ? findSingleVNode(node.children as VNode[]) : null

      if (nested) return nested
      continue
    }

    return node
  }

  return null
}
