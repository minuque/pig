import { lintIgnores } from "./scripts/check/lint-ignores.mjs"
import { stylelintPlugin } from "./scripts/check/no-comments.mjs"

/** @type {import("stylelint").Config} */
export default {
  ignoreFiles: lintIgnores,
  plugins: [stylelintPlugin],
  rules: {
    "pig/no-comments": true,
    "rule-empty-line-before": [
      "always",
      {
        except: ["first-nested"],
        ignore: ["after-comment"],
      },
    ],
    "at-rule-empty-line-before": [
      "always",
      {
        except: ["first-nested", "blockless-after-same-name-blockless"],
        ignore: ["after-comment"],
      },
    ],
    "block-no-empty": true,
    "declaration-block-no-duplicate-properties": [
      true,
      { ignore: ["consecutive-duplicates-with-different-values"] },
    ],
    "declaration-block-no-shorthand-property-overrides": true,
    // 应用间距刻度用 --space-*；写成 --spacing-* 会顶掉 max-w/min-w/w/size/leading 的默认刻度
    "custom-property-pattern": ["^(?!spacing-(xxs|xs|sm|md|lg|xl|xxl)$)[a-z0-9-]+$"],
    "no-duplicate-selectors": true,
    "property-no-unknown": [true, { ignoreProperties: ["app-region"] }],
    "selector-pseudo-class-no-unknown": [
      true,
      { ignorePseudoClasses: ["deep", "global", "slotted"] },
    ],
    "selector-pseudo-element-no-unknown": true,
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: [
          "theme",
          "utility",
          "plugin",
          "source",
          "custom-variant",
          "apply",
          "reference",
          "config",
          "variant",
        ],
      },
    ],
  },
  overrides: [
    {
      files: ["apps/web/src/style/tokens.css"],
      rules: { "pig/no-comments": [true, { sectionHeaders: true }] },
    },
    {
      files: ["**/*.vue"],
      customSyntax: "postcss-html",
      rules: {
        // SFC 只消费 token，色值写在 app.css
        "color-no-hex": true,
        // SFC 不声明新 --* 变量；仅放行 Radix 卡片/弹窗与全局滚动条的覆写槽
        "property-disallowed-list": [
          [
            "/^--(?!card-(?:surface|padding|border-radius|background-color)$|dialog-max-width$|scrollbar-thumb$)/",
          ],
          {
            message:
              "SFC 不声明新 --* 变量；请写进 tokens.css，仅允许覆写 --card-* / --dialog-max-width / --scrollbar-thumb",
          },
        ],
        // 局部隔离允许 0 / auto，其余层序一律读 tokens.css 的 --z-*
        "declaration-property-value-disallowed-list": {
          "z-index": ["/^-?[1-9]\\d*$/"],
        },
        "function-disallowed-list": [
          "rgb",
          "rgba",
          "hsl",
          "hsla",
          "hwb",
          "lab",
          "lch",
          "oklab",
          "oklch",
          "color",
          "color-mix",
        ],
      },
    },
  ],
}
