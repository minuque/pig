import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import githubDark from "shiki/themes/github-dark.mjs";
import githubLight from "shiki/themes/github-light.mjs";
import { h, type VNodeChild } from "vue";

/**
 * Shiki highlighting with a long-lived singleton highlighter and per-language
 * lazy loading. The JavaScript RegExp engine is used (no WASM) so the strict
 * CSP stays intact. Highlighted output is converted from HAST to VNodes —
 * never to HTML strings.
 */

type LanguageModule = { default: unknown };

const LANGUAGE_LOADERS: Record<string, () => Promise<LanguageModule>> = {
  bash: () => import("shiki/langs/bash.mjs"),
  c: () => import("shiki/langs/c.mjs"),
  clojure: () => import("shiki/langs/clojure.mjs"),
  cpp: () => import("shiki/langs/cpp.mjs"),
  csharp: () => import("shiki/langs/csharp.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  dart: () => import("shiki/langs/dart.mjs"),
  diff: () => import("shiki/langs/diff.mjs"),
  dockerfile: () => import("shiki/langs/dockerfile.mjs"),
  elixir: () => import("shiki/langs/elixir.mjs"),
  erlang: () => import("shiki/langs/erlang.mjs"),
  go: () => import("shiki/langs/go.mjs"),
  graphql: () => import("shiki/langs/graphql.mjs"),
  groovy: () => import("shiki/langs/groovy.mjs"),
  haskell: () => import("shiki/langs/haskell.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  ini: () => import("shiki/langs/ini.mjs"),
  java: () => import("shiki/langs/java.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  kotlin: () => import("shiki/langs/kotlin.mjs"),
  lua: () => import("shiki/langs/lua.mjs"),
  makefile: () => import("shiki/langs/makefile.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  "objective-c": () => import("shiki/langs/objective-c.mjs"),
  perl: () => import("shiki/langs/perl.mjs"),
  php: () => import("shiki/langs/php.mjs"),
  powershell: () => import("shiki/langs/powershell.mjs"),
  python: () => import("shiki/langs/python.mjs"),
  r: () => import("shiki/langs/r.mjs"),
  ruby: () => import("shiki/langs/ruby.mjs"),
  rust: () => import("shiki/langs/rust.mjs"),
  scala: () => import("shiki/langs/scala.mjs"),
  scss: () => import("shiki/langs/scss.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  swift: () => import("shiki/langs/swift.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
  vb: () => import("shiki/langs/vb.mjs"),
  vue: () => import("shiki/langs/vue.mjs"),
  xml: () => import("shiki/langs/xml.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
};

const LANGUAGE_ALIASES: Record<string, string> = {
  "c++": "cpp",
  cc: "cpp",
  cjs: "javascript",
  cs: "csharp",
  cxx: "cpp",
  docker: "dockerfile",
  gql: "graphql",
  golang: "go",
  js: "javascript",
  mjs: "javascript",
  objc: "objective-c",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  shell: "bash",
  shellscript: "bash",
  ts: "typescript",
  yml: "yaml",
  zsh: "bash",
};

/** Map a fence info string to a loadable Shiki language, or null for plain. */
export function normalizeLanguage(language: string): string | null {
  const lowered = language.trim().toLowerCase();
  if (lowered === "") return null;
  const aliased = LANGUAGE_ALIASES[lowered] ?? lowered;
  return aliased in LANGUAGE_LOADERS ? aliased : null;
}

let highlighterPromise: Promise<HighlighterCore> | null = null;
const loadedLanguages = new Set<string>();

function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= createHighlighterCore({
    themes: [githubLight, githubDark],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighterPromise;
}

export type HighlightedRoot = Awaited<ReturnType<HighlighterCore["codeToHast"]>>;

/**
 * Highlight code into a HAST tree with dual light/dark CSS variables.
 * Returns null for unknown/plain languages (rendered as plain code).
 */
export async function highlightToHast(
  code: string,
  language: string,
): Promise<HighlightedRoot | null> {
  const normalized = normalizeLanguage(language);
  if (normalized === null) return null;
  const highlighter = await getHighlighter();
  if (!loadedLanguages.has(normalized)) {
    const loader = LANGUAGE_LOADERS[normalized];
    if (!loader) return null;
    const module = await loader();
    await highlighter.loadLanguage(
      module.default as Parameters<HighlighterCore["loadLanguage"]>[0],
    );
    loadedLanguages.add(normalized);
  }
  return highlighter.codeToHast(code, {
    lang: normalized,
    themes: { light: "github-light", dark: "github-dark" },
  });
}

/* ---------- HAST → VNode (safe subset: pre/code/span + class/style) ------- */

interface HastText {
  type: "text";
  value: string;
}
interface HastElement {
  type: "element";
  tagName: string;
  properties?: { className?: unknown; style?: unknown };
  children?: HastNode[];
}
interface HastRootLike {
  type: "root";
  children?: HastNode[];
}
type HastNode = HastText | HastElement | HastRootLike | { type: string };

const ALLOWED_TAGS = new Set(["pre", "code", "span"]);

/** Convert a Shiki HAST tree into VNodes; disallowed nodes keep children. */
export function hastToVNodes(node: HastNode): VNodeChild[] {
  if (node.type === "text") return [(node as HastText).value];
  if (node.type === "root") {
    return ((node as HastRootLike).children ?? []).flatMap(hastToVNodes);
  }
  if (node.type !== "element") return [];
  const element = node as HastElement;
  const children = (element.children ?? []).flatMap(hastToVNodes);
  if (!ALLOWED_TAGS.has(element.tagName)) return children;
  const props: Record<string, unknown> = {};
  const className = element.properties?.className;
  if (Array.isArray(className) && className.length > 0) {
    props.class = className.filter((c): c is string => typeof c === "string");
  }
  const style = element.properties?.style;
  if (typeof style === "string" && style !== "") props.style = style;
  return [h(element.tagName, props, children)];
}
