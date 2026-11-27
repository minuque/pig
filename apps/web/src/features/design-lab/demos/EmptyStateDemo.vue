<template>
  <Story title="EmptyState">
    <Variant title="First use">
      <div class="frame">
        <EmptyState title="还没有 MCP Server" description="新增一个，或粘贴 mcpServers JSON 导入。">
          <template #art><HairlineArt figure="hub" /></template>
        </EmptyState>
      </div>
    </Variant>

    <Variant title="All done">
      <div class="frame">
        <EmptyState title="都整理好了" description="7 天没动过、已完成或出错的会话会出现在这里。">
          <template #art><HairlineArt figure="basket" /></template>
        </EmptyState>
      </div>
    </Variant>

    <Variant title="No results">
      <div class="frame">
        <EmptyState
          live
          title="没有匹配「invoice q3」的会话"
          description="检查拼写，或清除筛选后在全部项目里找。"
        >
          <template #art><HairlineArt figure="query" /></template>

          <template #actions>
            <Button variant="secondary" color="neutral">清除筛选</Button>
          </template>
        </EmptyState>
      </div>
    </Variant>

    <Variant title="Failed">
      <div class="frame">
        <EmptyState
          title="没能加载这个会话"
          description="会话记录没有被改动，可以再试一次。"
          detail="请求失败（HTTP_500）。关联 ID 3f2a9c1e-7b4d-4e0a-9f61-2c8d5e7a1b30"
        >
          <template #art><HairlineArt figure="plug" /></template>
          <template #actions><RetryButton :action="wait" /></template>
        </EmptyState>
      </div>
    </Variant>

    <Variant title="Failed with icon">
      <div class="frame">
        <EmptyState title="没能读取这个文件" description="文件没有被改动，可以再试一次。">
          <template #art><CircleExclamationPointIcon class="art-icon" /></template>
          <template #actions><RetryButton :action="wait" /></template>
        </EmptyState>
      </div>
    </Variant>

    <Variant title="Drawer and stack">
      <div class="pair">
        <div class="frame">
          <EmptyState title="还没有归档的会话">
            <template #art><HairlineArt figure="drawer" /></template>
          </EmptyState>
        </div>

        <div class="frame">
          <EmptyState title="还没有 Skill">
            <template #art><HairlineArt figure="stack" /></template>
          </EmptyState>
        </div>
      </div>
    </Variant>

    <Variant title="Row">
      <div class="rows">
        <EmptyState size="row" title="这个目录是空的" />

        <EmptyState size="row" title="没能读取这个目录">
          <template #actions><RetryButton size="s" variant="ghost" :action="wait" /></template>
        </EmptyState>

        <EmptyState size="row" live title="没有匹配「zzqx」的供应商">
          <template #actions>
            <Button size="s" variant="ghost" color="neutral">清除搜索</Button>
          </template>
        </EmptyState>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import HairlineArt from "@components/empty/HairlineArt.vue"
import RetryButton from "@components/empty/RetryButton.vue"
import { CircleExclamationPointIcon } from "@components/icons/index.js"
import { Button } from "@pig/ui/button"
import { EmptyState } from "@pig/ui/empty-state"

const wait = () => new Promise((resolve) => setTimeout(resolve, 1200))
</script>

<style scoped>
.frame {
  display: flex;
  flex-direction: column;
  block-size: 360px;
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-card);
  background-clip: padding-box;
}

.pair {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-md);
}

.rows {
  display: flex;
  flex-direction: column;
  max-inline-size: 360px;
  padding-inline: var(--space-sm);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-card);
  background-clip: padding-box;
}

.art-icon {
  inline-size: var(--icon-xl);
  block-size: var(--icon-xl);
}
</style>
