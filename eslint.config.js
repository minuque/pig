import js from "@eslint/js"
import { defineConfig, globalIgnores } from "eslint/config"
import globals from "globals"

import stylistic from "@stylistic/eslint-plugin"
import eslintConfigPrettier from "eslint-config-prettier/flat"
import pluginVue from "eslint-plugin-vue"
import tseslint from "typescript-eslint"

import { lintIgnores } from "./scripts/lint-ignores.mjs"

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
  // 只要会出错的规则；recommended 里的 warn 惯例/Options API 本仓用不上
  pluginVue.configs["flat/essential"],

  {
    name: "pig/overrides",
    rules: {
      "@typescript-eslint/no-explicit-any": "off", // 边界类型先 any，TS 收紧后再开
      "@typescript-eslint/no-unused-vars": "off", // 与 Vue 宏、前缀参数误报重叠，交给 TS
      "no-control-regex": "off", // ANSI/控制字符正则合法
      "no-empty": "off", // 允许空 catch / 占位块
      "no-empty-pattern": "off", // 允许空解构占位
      "prefer-const": "off", // 后续会赋值的 let 不强制改 const
      "preserve-caught-error": "off", // 不强制 catch 再抛时带 cause
      // 共享状态对象：允许改 props 字段，禁止替换 props 本身
      "vue/no-mutating-props": ["error", { shallowOnly: true }],
      // 对齐 SFC 顺序：template → script → style
      "vue/block-order": ["error", { order: ["template", "script", "style"] }],
      "vue/no-v-html": "error", // 禁止未消毒 HTML，防 XSS
    },
  },

  {
    name: "pig/vue-filenames",
    files: ["**/components/ui/**/*.vue", "**/features/*/index.vue"],
    // shadcn-vue 单字名；feature 入口按目录必须是 index.vue
    rules: {
      "vue/multi-word-component-names": "off",
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

  // 关掉与 Prettier 冲突的格式规则；分号由 Prettier 管
  eslintConfigPrettier,

  {
    name: "pig/vue-template",
    files: ["**/*.vue"],
    rules: {
      // 兄弟标签空行：多行块前后空一行，相邻单行标签不空
      "vue/padding-line-between-tags": [
        "error",
        [
          { blankLine: "always", prev: "*:multi-line", next: "*" },
          { blankLine: "always", prev: "*", next: "*:multi-line" },
          { blankLine: "never", prev: "*:single-line", next: "*:single-line" },
        ],
      ],

      // SFC 块之间空一行：<template> / <script> / <style>
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

        // 顶层非 import 前空一行（含 import 块之后）
        {
          blankLine: "always",
          prev: "*",
          next: { selector: "Program > :not(ImportDeclaration)" },
        },

        // 块内 function / class / interface / type 前
        {
          blankLine: "always",
          prev: "*",
          next: ["function", "class", "interface", "type"],
        },

        // type 别名不是 block-like，块后规则盖不住
        { blankLine: "always", prev: "type", next: "*" },

        // 多行绑定前后；函数里相邻短 const/let 仍可挤在一起
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

        // 控制流前；短函数里 return 前不强制空行
        {
          blankLine: "always",
          prev: "*",
          next: ["if", "switch", "try", "for", "while", "do"],
        },

        // 块状语句后
        { blankLine: "always", prev: "block-like", next: "*" },

        // —— 例外放最后 ——
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
