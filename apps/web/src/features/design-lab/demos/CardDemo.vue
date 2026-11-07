<template>
  <Story title="Card">
    <Variant title="变体">
      <div class="grid">
        <figure v-for="variant in VARIANTS" :key="variant" class="cell">
          <Card :variant="variant" size="s">
            <p class="card-title">标题</p>
            <p class="card-text">卡片正文，说明这个分组的用途。</p>
          </Card>

          <figcaption>{{ variant }}</figcaption>
        </figure>
      </div>
    </Variant>

    <Variant title="尺寸（内边距随档位变）">
      <div class="grid">
        <figure v-for="size in SIZES" :key="size" class="cell">
          <Card :size="size">
            <p class="card-title">标题</p>
            <p class="card-text">卡片正文，说明这个分组的用途。</p>
          </Card>

          <figcaption>{{ size }}</figcaption>
        </figure>
      </div>
    </Variant>

    <Variant title="业务里的用法">
      <div class="grid is-wide">
        <figure class="cell">
          <Card size="s" class="rows-card">
            <div v-for="row in ROWS" :key="row" class="row">
              <span>{{ row }}</span>
              <Switch :model-value="true" size="s" />
            </div>
          </Card>

          <figcaption>设置分组：行间用 --divider-top</figcaption>
        </figure>

        <figure class="cell">
          <Card size="s" class="list-card">
            <button v-for="row in PROVIDERS" :key="row" type="button" class="list-row">
              {{ row }}
              <AltArrowRightIcon class="size-icon" />
            </button>
          </Card>

          <figcaption>可点列表：内容贴边，悬停铺底</figcaption>
        </figure>

        <figure class="cell">
          <CodeCard>
            <pre class="code">
pnpm fix:touched
pnpm check:touched</pre>
          </CodeCard>

          <figcaption>代码卡：CodeCard，内边距交给内容</figcaption>
        </figure>

        <figure class="cell">
          <TableRoot variant="surface" size="s">
            <TableHeader>
              <TableRow>
                <TableCell kind="column-header">变量</TableCell>
                <TableCell kind="column-header">用途</TableCell>
              </TableRow>
            </TableHeader>

            <TableBody>
              <TableRow>
                <TableCell>--border</TableCell>
                <TableCell>卡片外环</TableCell>
              </TableRow>

              <TableRow>
                <TableCell>--radius-card</TableCell>
                <TableCell>卡片圆角</TableCell>
              </TableRow>
            </TableBody>
          </TableRoot>

          <figcaption>surface 表格：与卡片同一组变量</figcaption>
        </figure>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Card } from "@components/ui/card/index.js"
import { Switch } from "@components/ui/switch/index.js"
import {
  TableBody,
  TableCell,
  TableHeader,
  TableRoot,
  TableRow,
} from "@components/ui/table/index.js"
import { AltArrowRightIcon } from "@components/icons/index.js"
import CodeCard from "@features/transcript-view/components/CodeCard.vue"

const VARIANTS = ["surface", "classic", "ghost"] as const
const SIZES = ["s", "m", "l"] as const
const ROWS = ["发送后自动滚动", "完成时播放提示音", "显示思考过程"]
const PROVIDERS = ["Anthropic", "DeepSeek", "OpenAI"]
</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-md);
}

.grid.is-wide {
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
  margin: 0;
}

.cell figcaption {
  color: var(--contrast-foreground-muted);
  font-family: var(--font-mono);
  font-size: var(--text-micro);
}

.card-title,
.card-text {
  margin: 0;
}

.card-title {
  font-weight: var(--font-weight-medium);
}

.card-text {
  color: var(--contrast-foreground-muted);
  font-size: var(--text-meta);
}

.rows-card {
  --card-padding: 0;

  padding-inline: var(--space-md);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: calc(var(--size-control) + var(--space-md));
}

.row + .row,
.list-row + .list-row {
  box-shadow: var(--divider-top);
}

.list-card {
  --card-padding: 0;
}

.list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.list-row:hover {
  background: var(--hover-quiet);
}

.code {
  margin: 0;
  padding: var(--space-sm) var(--space-md);
  font-family: var(--font-mono);
  font-size: var(--text-code);
}
</style>
