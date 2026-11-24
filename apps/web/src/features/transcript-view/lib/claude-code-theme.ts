type Syntax = Record<string, { color?: string; font_style?: string; font_weight?: number }>

const scopes = (color: string, names: string[]): Syntax =>
  Object.fromEntries(names.map((name) => [name, { color }]))
export const claudeLightTheme = {
  name: "claude-light",
  appearance: "light",
  style: {
    background: "#ffffff",
    foreground: "#1a1a1a",
    syntax: {
      ...scopes("#1a1a1a", ["primary", "variable", "variable.parameter", "property", "embedded"]),
      ...scopes("#737373", [
        "punctuation",
        "punctuation.bracket",
        "punctuation.delimiter",
        "operator",
      ]),
      ...scopes("#1e9e3c", ["string", "string.special", "text.literal", "diff.plus"]),
      ...scopes("#98801f", ["string.escape", "string.regex"]),
      ...scopes("#cd2054", ["number", "boolean", "constant", "constant.builtin", "enum"]),
      ...scopes("#c5621b", ["keyword", "keyword.control", "keyword.declaration", "preproc", "tag"]),
      ...scopes("#0073e6", ["function", "function.definition", "function.method", "attribute"]),
      ...scopes("#8e6bd9", ["type", "type.builtin", "type.class", "constructor", "namespace"]),
      ...scopes("#ff3a30", ["diff.minus"]),
      comment: { color: "#999999", font_style: "italic" },
      title: { color: "#0073e6", font_weight: 700 },
      emphasis: { font_style: "italic" },
      "emphasis.strong": { font_weight: 700 },
    } satisfies Syntax,
  },
}
export const claudeDarkTheme = {
  name: "claude-dark",
  appearance: "dark",
  style: {
    background: "#1a1a19",
    foreground: "#eaecf0",
    syntax: {
      ...scopes("#eaecf0", ["primary", "variable", "property", "operator", "keyword.operator"]),
      ...scopes("#d3d7de", ["punctuation", "punctuation.bracket", "punctuation.delimiter"]),
      ...scopes("#818898", ["comment", "comment.doc"]),
      ...scopes("#cc7bf4", ["keyword", "keyword.control", "keyword.declaration", "preproc"]),
      ...scopes("#9be963", ["string", "string.special", "text.literal", "diff.plus"]),
      ...scopes("#96e35f", ["string.regex", "string.escape"]),
      ...scopes("#5eeded", ["number", "boolean", "constant", "constant.builtin", "link_uri"]),
      ...scopes("#f47b85", ["tag", "property.json_key", "diff.minus"]),
      ...scopes("#f0757f", ["attribute"]),
      ...scopes("#70b8ff", ["function", "function.definition", "function.method"]),
      ...scopes("#f7ab5f", ["variable.parameter"]),
      ...scopes("#fbad60", [
        "variable.special",
        "type",
        "type.builtin",
        "type.class",
        "constructor",
      ]),
      title: { font_weight: 700 },
      emphasis: { font_style: "italic" },
      "emphasis.strong": { font_weight: 700 },
    } satisfies Syntax,
  },
}
