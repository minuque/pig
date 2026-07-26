import { h, type VNodeChild } from "vue";
import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import CodeBlock from "@/features/transcript/components/CodeBlock.vue";

/**
 * Safe Markdown rendering: markdown-it runs with `html: false` (raw HTML is
 * emitted as escaped text tokens), and tokens are converted into Vue VNodes
 * — never HTML strings, never v-html/innerHTML. Links pass a protocol
 * whitelist; anything else renders as plain text without an anchor.
 */

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false,
});

const ALLOWED_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Returns the href when it is safe to render as an anchor, otherwise null.
 * Only http(s), mailto and document-relative links are allowed; dangerous
 * protocols such as javascript: or data: are rejected.
 */
export function safeLinkHref(href: string): string | null {
  const trimmed = href.trim();
  if (trimmed === "") return null;
  if (
    trimmed.startsWith("#") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../")
  ) {
    return trimmed;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  return ALLOWED_LINK_PROTOCOLS.has(url.protocol) ? trimmed : null;
}

/** Convert a Markdown source string into Vue VNodes. */
export function markdownToVNodes(source: string): VNodeChild[] {
  return blockTokensToVNodes(md.parse(source, {}));
}

function findClose(
  tokens: Token[],
  openIndex: number,
  openType: string,
  closeType: string,
): number {
  let depth = 0;
  for (let i = openIndex; i < tokens.length; i += 1) {
    const type = tokens[i]!.type;
    if (type === openType) depth += 1;
    else if (type === closeType) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return tokens.length - 1;
}

function blockTokensToVNodes(tokens: Token[]): VNodeChild[] {
  const out: VNodeChild[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i]!;
    const key = `b${i}`;
    switch (token.type) {
      case "paragraph_open": {
        const inline = tokens[i + 1]!;
        if (token.hidden) {
          // Tight list item: no <p> wrapper.
          out.push(...inlineToVNodes(inline));
        } else {
          out.push(h("p", { key }, inlineToVNodes(inline)));
        }
        i += 3;
        break;
      }
      case "heading_open": {
        out.push(h(token.tag, { key }, inlineToVNodes(tokens[i + 1]!)));
        i += 3;
        break;
      }
      case "fence":
      case "code_block": {
        const language =
          token.type === "fence"
            ? (token.info.trim().split(/\s+/)[0] ?? "")
            : "";
        out.push(
          h(CodeBlock, {
            key,
            code: token.content.replace(/\n$/, ""),
            language,
          }),
        );
        i += 1;
        break;
      }
      case "hr": {
        out.push(h("hr", { key }));
        i += 1;
        break;
      }
      case "blockquote_open": {
        const end = findClose(tokens, i, "blockquote_open", "blockquote_close");
        out.push(
          h(
            "blockquote",
            { key },
            blockTokensToVNodes(tokens.slice(i + 1, end)),
          ),
        );
        i = end + 1;
        break;
      }
      case "bullet_list_open":
      case "ordered_list_open": {
        const closeType =
          token.type === "bullet_list_open"
            ? "bullet_list_close"
            : "ordered_list_close";
        const end = findClose(tokens, i, token.type, closeType);
        out.push(
          h(token.tag, { key }, listItemsToVNodes(tokens.slice(i + 1, end))),
        );
        i = end + 1;
        break;
      }
      case "table_open": {
        const end = findClose(tokens, i, "table_open", "table_close");
        out.push(tableToVNode(tokens.slice(i + 1, end), key));
        i = end + 1;
        break;
      }
      case "inline": {
        out.push(h("p", { key }, inlineToVNodes(token)));
        i += 1;
        break;
      }
      default: {
        i += 1;
        break;
      }
    }
  }
  return out;
}

function listItemsToVNodes(tokens: Token[]): VNodeChild[] {
  const out: VNodeChild[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i]!;
    if (token.type === "list_item_open") {
      const end = findClose(tokens, i, "list_item_open", "list_item_close");
      out.push(
        h(
          "li",
          { key: `li${i}` },
          blockTokensToVNodes(tokens.slice(i + 1, end)),
        ),
      );
      i = end + 1;
    } else {
      i += 1;
    }
  }
  return out;
}

function tableToVNode(tokens: Token[], key: string): VNodeChild {
  const headRows: VNodeChild[] = [];
  const bodyRows: VNodeChild[] = [];
  let section: "head" | "body" | null = null;
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i]!;
    if (token.type === "thead_open") section = "head";
    else if (token.type === "thead_close") section = null;
    else if (token.type === "tbody_open") section = "body";
    else if (token.type === "tbody_close") section = null;
    else if (token.type === "tr_open" && section !== null) {
      const end = findClose(tokens, i, "tr_open", "tr_close");
      const cells: VNodeChild[] = [];
      const rowTokens = tokens.slice(i + 1, end);
      for (let j = 0; j < rowTokens.length; j += 1) {
        const cell = rowTokens[j]!;
        if (cell.type === "th_open" || cell.type === "td_open") {
          const inline = rowTokens[j + 1];
          cells.push(
            h(
              cell.tag,
              { key: `c${j}` },
              inline && inline.type === "inline" ? inlineToVNodes(inline) : [],
            ),
          );
          j += 2;
        }
      }
      const row = h("tr", { key: `r${i}` }, cells);
      if (section === "head") headRows.push(row);
      else bodyRows.push(row);
      i = end + 1;
    } else {
      i += 1;
    }
  }
  return h("table", { key }, [
    headRows.length > 0 ? h("thead", headRows) : null,
    bodyRows.length > 0 ? h("tbody", bodyRows) : null,
  ]);
}

interface InlineFrame {
  /** "__text__" renders children without a wrapper (rejected links). */
  tag: string;
  props: Record<string, unknown>;
  children: VNodeChild[];
}

function inlineToVNodes(inline: Token): VNodeChild[] {
  const root: VNodeChild[] = [];
  const stack: InlineFrame[] = [];
  const current = (): VNodeChild[] =>
    stack.length > 0 ? stack[stack.length - 1]!.children : root;
  const closeFrame = () => {
    const frame = stack.pop();
    if (!frame) return;
    if (frame.tag === "__text__") current().push(...frame.children);
    else current().push(h(frame.tag, frame.props, frame.children));
  };

  for (const token of inline.children ?? []) {
    switch (token.type) {
      case "text": {
        // Vue escapes text children; raw HTML from the source is inert here.
        current().push(token.content);
        break;
      }
      case "code_inline": {
        current().push(h("code", { class: "md-inline-code" }, token.content));
        break;
      }
      case "softbreak": {
        current().push(" ");
        break;
      }
      case "hardbreak": {
        current().push(h("br"));
        break;
      }
      case "em_open":
      case "strong_open":
      case "s_open": {
        stack.push({
          tag: token.type.slice(0, token.type.indexOf("_")),
          props: {},
          children: [],
        });
        break;
      }
      case "link_open": {
        const href = safeLinkHref(token.attrGet("href") ?? "");
        if (href === null) {
          stack.push({ tag: "__text__", props: {}, children: [] });
        } else {
          stack.push({
            tag: "a",
            props: {
              href,
              target: "_blank",
              rel: "noopener noreferrer nofollow",
              class: "md-link",
            },
            children: [],
          });
        }
        break;
      }
      case "em_close":
      case "strong_close":
      case "s_close":
      case "link_close": {
        closeFrame();
        break;
      }
      case "image": {
        // Remote images are never fetched; the alt text is shown instead.
        const alt = token.content.trim();
        current().push(
          h(
            "span",
            { class: "md-image-alt" },
            `[图片${alt === "" ? "" : `: ${alt}`}]`,
          ),
        );
        break;
      }
      default: {
        // html_inline and unknown inline tokens are dropped to inert text.
        if (token.type === "html_inline") current().push(token.content);
        break;
      }
    }
  }
  while (stack.length > 0) closeFrame();
  return root;
}
