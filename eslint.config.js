import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/out/**",
      "docs/**",
      ".worktrees/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-control-regex": "off",
      "no-empty": "off",
      "no-empty-pattern": "off",
      "prefer-const": "off",
      "preserve-caught-error": "off",
      // 共享状态对象模式：props 传可变对象改字段合法，仅拦替换 props 本身
      "vue/no-mutating-props": ["error", { shallowOnly: true }],
    },
  },
  {
    files: ["**/components/ui/**/*.vue", "**/features/*/index.vue"],
    // shadcn-vue 单字名；feature 入口按目录规范必须是 index.vue
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  eslintConfigPrettier,
);
