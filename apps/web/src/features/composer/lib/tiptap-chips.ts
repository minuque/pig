import { Extension, Node, mergeAttributes, type Extensions } from "@tiptap/core"
import { history, redo, undo } from "@tiptap/pm/history"
import { keymap } from "@tiptap/pm/keymap"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { ComposerCommandKind } from "@features/composer/type.js"

export interface FileMentionOptions {
  onOpenFile?: ((path: string) => void) | undefined
}

const SELECTED_CLASS = "is-chip-selected"
const CHIP_CLASS = "chip"

function attributeSource(name: string): (element: HTMLElement) => string {
  return (element) => element.getAttribute(name) ?? ""
}

function chipLabel(path: string, label: string): string {
  return label || path.split("/").filter(Boolean).pop() || path
}

function commandLabel(name: string, kind: ComposerCommandKind | undefined): string {
  return kind === "skill" ? `skill:${name}` : name
}

export const ComposerDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "paragraph+",
})
export const ComposerParagraph = Node.create({
  name: "paragraph",
  group: "block",
  content: "inline*",
  parseHTML: () => [{ tag: "p" }],
  renderHTML: () => ["p", 0],
})
export const ComposerText = Node.create({
  name: "text",
  group: "inline",
})
export const ComposerHistory = Extension.create({
  name: "composerHistory",
  addProseMirrorPlugins: () => [
    history(),
    keymap({ "Mod-z": undo, "Mod-y": redo, "Shift-Mod-z": redo }),
  ],
})
export const FileMentionNode = Node.create<FileMentionOptions>({
  name: "fileMention",
  inline: true,
  group: "inline",
  atom: true,
  selectable: false,
  draggable: false,
  addOptions: () => ({ onOpenFile: undefined }),
  addAttributes: () => ({
    path: {
      default: "",
      parseHTML: attributeSource("data-file-mention"),
      renderHTML: () => ({}),
    },
    label: {
      default: null,
      parseHTML: (element) => element.textContent ?? "",
      renderHTML: () => ({}),
    },
  }),
  parseHTML: () => [{ tag: "span[data-file-mention]" }],
  renderHTML: ({ node, HTMLAttributes }) => {
    const path = String(node.attrs["path"] ?? "")
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: CHIP_CLASS,
        "data-file-mention": path,
        title: path,
      }),
      chipLabel(path, String(node.attrs["label"] ?? "")),
    ]
  },
  addProseMirrorPlugins() {
    const onOpenFile = () => this.options.onOpenFile
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            click(_view, event) {
              const target = event.target

              if (!(target instanceof Element)) return false
              const path = target.closest("[data-file-mention]")?.getAttribute("data-file-mention")

              if (!path) return false
              onOpenFile()?.(path)
              return true
            },
          },
        },
      }),
    ]
  },
})
export const CommandChipNode = Node.create({
  name: "commandChip",
  inline: true,
  group: "inline",
  atom: true,
  selectable: false,
  draggable: false,
  addAttributes: () => ({
    name: {
      default: "",
      parseHTML: attributeSource("data-command-chip"),
      renderHTML: () => ({}),
    },
    kind: {
      default: null,
      parseHTML: (element) => element.getAttribute("data-command-kind"),
      renderHTML: () => ({}),
    },
  }),
  parseHTML: () => [{ tag: "span[data-command-chip]" }],
  renderHTML: ({ node, HTMLAttributes }) => {
    const name = String(node.attrs["name"] ?? "")
    const kind = node.attrs["kind"] === "skill" ? "skill" : undefined
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: CHIP_CLASS,
        "data-command-chip": name,
        ...(kind ? { "data-command-kind": kind } : {}),
        title: `/${commandLabel(name, kind)}`,
      }),
      commandLabel(name, kind),
    ]
  },
})

function chipSpans(doc: ProseMirrorNode, from: number, to: number): Decoration[] {
  const decorations: Decoration[] = []

  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isInline || !node.isAtom) return

    if (pos >= to || pos + node.nodeSize <= from) return
    decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: SELECTED_CLASS }))
  })
  return decorations
}

export function createChipSelectionPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey("composerChipSelection"),
    props: {
      decorations(state) {
        const { selection } = state

        if (!(selection instanceof TextSelection) || selection.empty) return null
        return DecorationSet.create(state.doc, chipSpans(state.doc, selection.from, selection.to))
      },
      handleDOMEvents: {
        compositionstart(view) {
          if (view.state.selection.empty) return false
          view.dispatch(view.state.tr.deleteSelection())
          return false
        },
      },
    },
  })
}

export const ComposerChipSelection = Extension.create({
  name: "composerChipSelection",
  addProseMirrorPlugins: () => [createChipSelectionPlugin()],
})

export function createComposerExtensions(options: FileMentionOptions = {}): Extensions {
  return [
    ComposerDocument,
    ComposerParagraph,
    ComposerText,
    ComposerHistory,
    FileMentionNode.configure(options),
    CommandChipNode,
    ComposerChipSelection,
  ]
}
