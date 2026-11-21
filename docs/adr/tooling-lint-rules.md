# Lint 规则的开关与配置

- 状态：已采纳
- 代码：`eslint.config.js`、`stylelint.config.js`

## 背景

ESLint 管 `.ts` `.js` `.mjs` `.vue` 的脚本与模板，Stylelint 管 `.css` 与 `<style>`。预设里有几条规则与本仓的写法、其他工具或设计规则冲突，逐条关掉或改配置，取舍原因不写在代码里。

## 决定

### Vue 只启用 flat/essential

`pluginVue.configs["flat/essential"]` 只留会出错的规则。recommended 里的 warn 惯例与 Options API 规则本仓用不上（组合式 API、`<script setup>`），开着只制造噪音。

### 两条交给 TypeScript 的规则

`@typescript-eslint/no-unused-vars` 关掉：与 Vue 宏、前缀参数（`_page` 这类）误报重叠，未使用变量由 `tsc` 与编辑器报。`no-control-regex` 关掉：ANSI 转义与控制字符正则里本来就得写控制字符。

### `vue/no-mutating-props` 用 shallowOnly

共享状态对象作为 prop 传入时，改它的字段是本仓的既定做法，替换 props 本身仍然禁止。所以只拦替换。

### 两处组件文件名单字

`components/ui/**` 是 shadcn-vue 生成的文件，名字是单字；`features/*/index.vue` 是 feature 入口，按目录固定。这两处关掉 `vue/multi-word-component-names`。

### 格式规则交给 Prettier

`eslint-config-prettier` 关掉所有与 Prettier 冲突的格式规则。分号、缩进、空行只由 Prettier 决定，ESLint 不参与，免得多条规则互相打架。

### 事件绑定只允许一条语句

`pig/vue-event-single-statement` 是自写规则。多条语句写进一个 `@click`，Prettier 去掉分号后 Vue 模板编译失败，所以在编译前就禁掉，多条逻辑一律移到方法里。

### 禁用 `--spacing-*` 前缀

`custom-property-pattern` 不接受 `--spacing-xxs` 到 `--spacing-xxl`。这几个名字会顶掉 utility 层为 `max-w` / `min-w` / `w` / `size` / `leading` 提供的默认刻度，应用间距刻度统一写 `--space-*`。

## 后果

- 关掉的规则不再拦对应写法，边界类型里的 `any` 这类问题靠评审兜住。
- 新增或重开规则前先看这里，避免与 Prettier、TS、tokens 的既有分工重复。
