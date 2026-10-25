import { lintIgnores } from "./scripts/lint-ignores.mjs"

/** @type {import("stylelint").Config} */
export default {
  ignoreFiles: lintIgnores,
  rules: {
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
      files: ["**/*.vue"],
      customSyntax: "postcss-html",
      rules: {
        // SFC 只消费 token，色值写在 app.css
        "color-no-hex": true,
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
