import type { Node, ElementNode } from "comark"

/** 词级淡入节奏，移植自 cc-wrapper response-reveal-model：文字即时上屏，按批错开淡入。 */
export const REVEAL_TAG = "reveal-words"
export const REVEAL_FADE_MS = 200
export const REVEAL_SETTLE_MS = 1000
const PRIMED_CHARS = 400
const MS_PER_CHAR = 2.5
const MAX_LEAD_MS = 600
const BATCH_OPEN_MS = 100
const PASS_BATCH_CHARS = 16
const CARRY_BATCH_CHARS = 48

type Entry = { pass: number; chars: number; startsAt: number; done: boolean; decorated: boolean }

const ATOMIC = new Set(["code", "kbd", "sup", "a"])
const BLOCKS = new Set([
  ...["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote"],
  ...["table", "thead", "tbody", "tr", "td", "th", "section"],
])
const IGNORED = new Set(["pre", "img", "input", "button", "script", "style"])
const words = (text: string): string[] => text.match(/(?:^\s+)?\S+\s*/g) ?? []

function textLength(node: Node): number {
  if (typeof node === "string") return node.length

  if (node[0] === null) return 0
  let sum = 0

  for (let i = 2; i < node.length; i++) sum += textLength(node[i] as Node)
  return sum
}

function createLedger(initialText: string, now: () => number) {
  let previous = initialText
  let primed = initialText.length > PRIMED_CHARS
  let pass = 0
  let batch: Entry | null = null
  let opened = 0
  let scheduled = 0
  let horizon = 0
  const entries = new Map<string, Entry>()
  const close = (time: number) => {
    batch = null
    horizon = time
  }

  return {
    begin(text: string) {
      const time = now()
      pass++

      if (!text.startsWith(previous)) {
        for (const entry of entries.values()) entry.done = true
        close(time)
      } else if (
        batch &&
        time - opened >= BATCH_OPEN_MS &&
        /\s\S/.test(previous.slice(-1) + text.slice(previous.length))
      ) {
        close(time)
      }

      if (text !== previous) primed = false
      previous = text
    },
    reveal(key: string, length: number): Entry {
      const hit = entries.get(key)

      if (hit) return hit
      const time = now()

      if (primed) {
        const entry = { pass, chars: 0, startsAt: 0, done: true, decorated: false }
        entries.set(key, entry)
        return entry
      }

      const limit = batch?.pass === pass ? PASS_BATCH_CHARS : CARRY_BATCH_CHARS

      scheduled = Math.min(Math.max(time, scheduled) + length * MS_PER_CHAR, time + MAX_LEAD_MS)

      if (!batch || batch.chars + length > limit) {
        if (!batch) opened = time
        batch = { pass, chars: 0, startsAt: Math.round(scheduled), done: false, decorated: false }
      }

      batch.chars += length
      entries.set(key, batch)
      return batch
    },
    settled(entry: Entry): boolean {
      if (!entry.done && horizon >= entry.startsAt + REVEAL_FADE_MS) entry.done = true
      return entry.done
    },
  }
}

type Ledger = ReturnType<typeof createLedger>

function wrap(children: Node[], entry: Entry): ElementNode {
  entry.decorated = true
  return [REVEAL_TAG, { at: String(entry.startsAt) }, ...children]
}

function decorateChildren(
  parent: ElementNode,
  ledger: Ledger,
  ns: string,
  cursor: { offset: number },
): ElementNode {
  const out: Node[] = []
  let blockIndex = 0

  for (let i = 2; i < parent.length; i++) {
    const child = parent[i] as Node

    if (typeof child === "string") {
      const parts = words(child)
      let current: ElementNode | null = null
      let currentEntry: Entry | null = null

      if (!parts.length) {
        out.push(child)
        cursor.offset += child.length
        continue
      }

      for (const part of parts) {
        const entry = ledger.reveal(`${ns}:${cursor.offset}`, part.length)
        cursor.offset += part.length

        if (ledger.settled(entry) && !entry.decorated) {
          out.push(part)
          current = null
        } else if (current && currentEntry === entry) {
          current[2] = (current[2] as string) + part
        } else {
          current = wrap([part], entry)
          currentEntry = entry
          out.push(current)
        }
      }

      continue
    }

    const tag = child[0]

    if (tag === null || IGNORED.has(tag)) {
      out.push(child)
      cursor.offset += textLength(child)
    } else if (ATOMIC.has(tag)) {
      const length = textLength(child)
      const entry = ledger.reveal(`${ns}:${cursor.offset}`, length)
      cursor.offset += length
      out.push(length && (!ledger.settled(entry) || entry.decorated) ? wrap([child], entry) : child)
    } else if (BLOCKS.has(tag)) {
      out.push(decorateChildren(child, ledger, `${ns}.b${blockIndex++}`, { offset: 0 }))
    } else {
      out.push(decorateChildren(child, ledger, ns, cursor))
    }
  }

  return [parent[0], parent[1], ...out]
}

/** 每条流式消息一个实例；已装饰的根节点按引用缓存，只给新节点算排期。 */
export function createResponseReveal(
  initialText: string,
  now: () => number = () => performance.now(),
) {
  const ledger = createLedger(initialText, now)
  let cache = new WeakMap<object, Node>()
  let finished = false
  return {
    begin(text: string) {
      if (!finished) ledger.begin(text)
    },
    decorate(nodes: Node[]): Node[] {
      if (finished) return nodes
      return nodes.map((node, index) => {
        if (typeof node === "string" || node[0] === null || IGNORED.has(node[0])) return node
        const hit = cache.get(node)

        if (hit) return hit
        const root: ElementNode = ["section", {}, node]
        const decorated = decorateChildren(root, ledger, `m.r${index}`, { offset: 0 })[2] as Node
        cache.set(node, decorated)
        return decorated
      })
    },
    finish() {
      finished = true
      cache = new WeakMap()
    },
  }
}
