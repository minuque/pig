import js from "@eslint/js"
import { defineConfig, globalIgnores } from "eslint/config"
import globals from "globals"

import stylistic from "@stylistic/eslint-plugin"
import eslintConfigPrettier from "eslint-config-prettier/flat"
import pluginVue from "eslint-plugin-vue"
import tseslint from "typescript-eslint"

import { lintIgnores } from "./scripts/check/lint-ignores.mjs"
import { eslintPlugin as noComments } from "./scripts/check/no-comments.mjs"

export default defineConfig(
  globalIgnores(lintIgnores, "pig/ignores"),

  {
    name: "pig/globals",
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  js.configs.recommended,
  tseslint.configs.recommended,
  pluginVue.configs["flat/essential"],

  {
    name: "pig/overrides",
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "no-control-regex": "off",
      "no-empty": "off",
      "no-empty-pattern": "off",
      "prefer-const": "off",
      "preserve-caught-error": "off",
      "vue/no-mutating-props": ["error", { shallowOnly: true }],
      "vue/block-order": ["error", { order: ["template", "script", "style"] }],
      "vue/no-v-html": "error",
    },
  },

  {
    name: "pig/no-comments",
    plugins: { "pig-comments": noComments },
    rules: { "pig-comments/no-comments": "error" },
  },

  {
    name: "pig/no-comments-protocol",
    files: ["packages/protocol/src/**"],
    rules: { "pig-comments/no-comments": ["error", { contractDocs: true }] },
  },

  {
    name: "pig/vue-filenames",
    files: ["packages/ui/src/ui/**/*.vue", "**/features/*/index.vue"],
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },

  {
    name: "pig/session-state-layer",
    files: ["apps/web/src/features/session/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^@features/(?!session/)",
              message: "features/session 是状态层，不引用别的 feature。",
            },
          ],
        },
      ],
    },
  },

  {
    name: "pig/ui-layer",
    files: ["packages/ui/src/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex:
                "^(@/|@(features|client|router|components|style|i18n|utils)/|@vueuse/|.*apps/web)",
              message: "packages/ui 是独立可复用设计系统包，禁止依赖应用路径或应用工具库。",
            },
          ],
        },
      ],
    },
  },

  {
    name: "pig/vue-parser",
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  eslintConfigPrettier,

  {
    name: "pig/vue-template",
    files: ["**/*.vue"],
    plugins: {
      pig: {
        rules: {
          "vue-event-single-statement": {
            meta: {
              type: "problem",
              docs: { description: "事件绑定只允许一条语句" },
              schema: [],
              messages: { multiple: "事件绑定只允许一条语句，多条逻辑移到方法里。" },
            },
            create(context) {
              const source = context.sourceCode.parserServices?.defineTemplateBodyVisitor

              if (!source) return {}
              return source({
                VOnExpression(node) {
                  if (node.body.length > 1) context.report({ node, messageId: "multiple" })
                },
              })
            },
          },
        },
      },
    },
    rules: {
      "pig/vue-event-single-statement": "error",
      "vue/padding-line-between-tags": [
        "error",
        [
          { blankLine: "always", prev: "*:multi-line", next: "*" },
          { blankLine: "always", prev: "*", next: "*:multi-line" },
          { blankLine: "never", prev: "*:single-line", next: "*:single-line" },
        ],
      ],

      "vue/padding-line-between-blocks": ["error", "always"],
    },
  },

  {
    name: "pig/style",
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
      "@stylistic/padding-line-between-statements": [
        "error",

        {
          blankLine: "always",
          prev: "*",
          next: { selector: "Program > :not(ImportDeclaration)" },
        },

        {
          blankLine: "always",
          prev: "*",
          next: ["function", "class", "interface", "type"],
        },

        { blankLine: "always", prev: "type", next: "*" },

        {
          blankLine: "always",
          prev: "*",
          next: ["multiline-const", "multiline-let", "multiline-var", "multiline-using"],
        },
        {
          blankLine: "always",
          prev: ["multiline-const", "multiline-let", "multiline-var", "multiline-using"],
          next: "*",
        },

        {
          blankLine: "always",
          prev: "*",
          next: ["if", "switch", "try", "for", "while", "do"],
        },

        { blankLine: "never", prev: "*", next: "return" },

        { blankLine: "always", prev: "block-like", next: "*" },

        {
          blankLine: "never",
          prev: {
            selector:
              ':matches(VariableDeclaration, ExportNamedDeclaration[declaration.type="VariableDeclaration"])',
          },
          next: {
            selector:
              ':matches(VariableDeclaration, ExportNamedDeclaration[declaration.type="VariableDeclaration"])',
          },
        },
        { blankLine: "any", prev: "import", next: "import" },
        {
          blankLine: "any",
          prev: {
            selector:
              ':matches(TSDeclareFunction, ExportNamedDeclaration[declaration.type="TSDeclareFunction"])',
          },
          next: {
            selector:
              ':matches(TSDeclareFunction, FunctionDeclaration, ExportNamedDeclaration[declaration.type="TSDeclareFunction"], ExportNamedDeclaration[declaration.type="FunctionDeclaration"])',
          },
        },
      ],
    },
  },
)
