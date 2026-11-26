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
    "custom-property-pattern": ["^(?!spacing-(xxs|xs|sm|md|lg|xl|xxl)$)[a-z0-9-]+$"],
    "no-duplicate-selectors": true,
    "property-no-unknown": [true, { ignoreProperties: ["app-region"] }],
    "selector-pseudo-class-no-unknown": [
      true,
      { ignorePseudoClasses: ["deep", "global", "slotted"] },
    ],
    "selector-pseudo-element-no-unknown": true,
    "at-rule-no-unknown": true,
  },
  overrides: [
    {
      files: ["apps/web/src/style/tokens.css", "packages/ui/src/styles/tokens.css"],
      rules: { "pig/no-comments": [true, { sectionHeaders: true }] },
    },
    ...((rules) => [
      { files: ["**/*.vue"], customSyntax: "postcss-html", rules },
      {
        files: ["apps/web/src/features/**/*.css", "apps/web/src/components/**/*.css"],
        rules,
      },
    ])({
      "color-no-hex": true,
      "property-disallowed-list": [
        [
          "/^--(?!card-(?:surface|padding|border-radius|background-color)$|dialog-max-width$|scrollbar-thumb$)/",
        ],
        {
          message:
            "SFC 不声明新 --* 变量；请写进 tokens.css，仅允许覆写 --card-* / --dialog-max-width / --scrollbar-thumb",
        },
      ],
      "declaration-property-value-disallowed-list": {
        "z-index": ["/^-?[1-9]\\d*$/"],
        "font-size": ["/^(?!var\\(--|calc\\(|inherit$|[\\d.]+em$)/"],
        "border-radius": ["/^(?!var\\(--|calc\\(|min\\(|max\\(|inherit$|0$|50%$|100%$)/"],
        transition: ["/^(?!none$|inherit$|var\\(--|[\\s\\S]*var\\(--duration-)/"],
        "transition-duration": ["/^(?!var\\(--duration-|none$|inherit$|0(?:m?s)?$)/"],
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
    }),
  ],
}
