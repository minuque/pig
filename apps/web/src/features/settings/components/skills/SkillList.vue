<template>
  <section class="skill-list">
    <ScopeToolbar
      :label="t('settings.skills.title')"
      :add-label="t('settings.skills.add')"
      :scope="scope"
      :workspace="workspace"
      :query="query"
      @update:scope="emit('update:scope', $event)"
      @update:query="query = $event"
      @add="emit('add')"
    />

    <EmptyState
      v-if="state.error.value && !state.view.value"
      class="list-empty"
      :title="t('settings.skills.loadFailedTitle')"
      :description="t('settings.skills.loadFailedBody')"
      :detail="state.error.value"
    >
      <template #art><HairlineArt figure="plug" /></template>
      <template #actions><RetryButton :action="state.refresh" /></template>
    </EmptyState>

    <p v-else-if="state.error.value" class="list-note">{{ state.error.value }}</p>

    <section v-for="group in groups" :key="group.dir" class="skill-group">
      <h3 class="group-path">{{ group.dir }}</h3>

      <CardList>
        <CardRow v-for="skill in group.skills" :key="skill.filePath" interactive class="skill-row">
          <button type="button" class="row-open" @click="emit('open', skill.filePath)">
            <span class="row-main">
              <span class="row-name">
                {{ skill.name }}

                <Badge
                  v-if="collisions.get(skill.name)"
                  size="s"
                  variant="soft"
                  color="warning"
                  :title="collisions.get(skill.name)"
                >
                  {{ t("settings.skills.collision") }}
                </Badge>
              </span>

              <span class="row-sub">{{ skill.description }}</span>
            </span>
          </button>

          <Switch
            :model-value="skill.enabled"
            size="s"
            :aria-label="skill.name"
            @update:model-value="state.setEnabled(skill, $event)"
          />

          <ChevronRightIcon class="row-chevron" />
        </CardRow>

        <CardRow
          v-for="issue in group.issues"
          :key="issue.path"
          :interactive="issue.kind === 'broken'"
          class="skill-row"
        >
          <component
            :is="issue.kind === 'broken' ? 'button' : 'span'"
            :type="issue.kind === 'broken' ? 'button' : undefined"
            class="row-open"
            @click="issue.kind === 'broken' && emit('fix', issue.path)"
          >
            <span class="row-main">
              <span class="row-name">
                {{ issue.name || issue.path }}

                <Badge size="s" variant="soft" color="warning">
                  {{ t(`settings.skills.${issue.kind}`) }}
                </Badge>
              </span>

              <span class="row-sub">{{ issue.message }}</span>
            </span>
          </component>

          <ChevronRightIcon v-if="issue.kind === 'broken'" class="row-chevron" />
        </CardRow>
      </CardList>
    </section>

    <template v-if="state.view.value && !groups.length">
      <EmptyState
        v-if="!query.trim()"
        class="list-empty"
        :title="t('settings.skills.emptyTitle')"
        :description="t('settings.skills.emptyBody')"
      >
        <template #art><HairlineArt figure="stack" /></template>
      </EmptyState>

      <EmptyState
        v-else-if="!inherited.length"
        class="list-empty"
        live
        :title="t('settings.skills.noMatch', { query: query.trim() })"
        :description="t('settings.skills.noMatchBody')"
      >
        <template #art><HairlineArt figure="query" /></template>

        <template #actions>
          <Button type="button" variant="secondary" color="neutral" @click="query = ''">
            {{ t("common.clearSearch") }}
          </Button>
        </template>
      </EmptyState>
    </template>

    <Collapsible v-if="inherited.length" v-model:open="inheritedOpen">
      <CollapsibleTrigger>
        <template #render="{ props: part }">
          <button v-bind="part" type="button" class="fold-trigger">
            <ChevronRightIcon class="fold-chevron" :data-open="inheritedOpen ? '' : undefined" />
            {{ t("settings.skills.inheritedMore", { count: inherited.length }) }}
          </button>
        </template>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <CardList class="fold-body">
          <CardRow v-for="skill in inherited" :key="skill.filePath" interactive class="skill-row">
            <button type="button" class="row-open" @click="emit('open', skill.filePath)">
              <span class="row-main">
                <span class="row-name">{{ skill.name }}</span>
                <span class="row-sub">{{ skill.description }}</span>
              </span>
            </button>

            <ChevronRightIcon class="row-chevron" />
          </CardRow>
        </CardList>
      </CollapsibleContent>
    </Collapsible>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import type { SkillDiagnosticView, SkillView } from "@pig/protocol"

import { ChevronRightIcon } from "@components/icons/index.js"
import ScopeToolbar from "@features/settings/components/ScopeToolbar.vue"
import type { SkillsState } from "@features/settings/hooks/use-skills.js"
import { useI18n } from "@i18n/index.js"
import HairlineArt from "@components/empty/HairlineArt.vue"
import RetryButton from "@components/empty/RetryButton.vue"
import { Badge } from "@pig/ui/badge"
import { Button } from "@pig/ui/button"
import { CardList, CardRow } from "@pig/ui/card"
import { EmptyState } from "@pig/ui/empty-state"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@pig/ui/collapsible"
import { Switch } from "@pig/ui/switch"

const props = defineProps<{ state: SkillsState; scope: string; workspace: string | undefined }>()
const emit = defineEmits<{
  "update:scope": [scope: string]
  open: [path: string]
  fix: [path: string]
  add: []
}>()
const { t } = useI18n()
const query = ref("")
const inheritedOpen = ref(false)

function matches(...parts: string[]) {
  const q = query.value.trim().toLowerCase()
  return !q || parts.join(" ").toLowerCase().includes(q)
}

function rootOf(path: string) {
  return `${path
    .split(/[\\/]/)
    .slice(0, -2)
    .join(path.includes("\\") ? "\\" : "/")}${path.includes("\\") ? "\\" : "/"}`
}

const own = computed(() =>
  (props.state.view.value?.skills ?? []).filter((s) => matches(s.name, s.description)),
)
const collisions = computed(
  () =>
    new Map(
      (props.state.view.value?.diagnostics ?? [])
        .filter((d) => d.kind === "collision" && own.value.some((s) => s.name === d.name))
        .map((d) => [d.name ?? "", d.message]),
    ),
)
const groups = computed(() => {
  const map = new Map<string, { dir: string; skills: SkillView[]; issues: SkillDiagnosticView[] }>()
  const groupOf = (path: string) => {
    const dir = rootOf(path)
    const group = map.get(dir) ?? { dir, skills: [], issues: [] }

    map.set(dir, group)
    return group
  }

  for (const skill of own.value) groupOf(skill.filePath).skills.push(skill)

  for (const issue of props.state.view.value?.diagnostics ?? [])
    if (!collisions.value.has(issue.name ?? "") && matches(issue.name ?? "", issue.path))
      groupOf(issue.path).issues.push(issue)
  return [...map.values()]
})
const inherited = computed(() =>
  (props.state.view.value?.inherited ?? []).filter((s) => matches(s.name, s.description)),
)
</script>

<style scoped>
.skill-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.skill-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.group-path {
  margin: 0;
  padding-inline: var(--space-md);
  color: var(--fg-muted);
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-normal);
}

.skill-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.row-open {
  display: flex;
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: start;
}

button.row-open {
  cursor: pointer;
}

.row-main {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  padding-block: var(--space-xs);
}

.row-name {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--fg);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
}

.row-sub {
  overflow: hidden;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-chevron,
.fold-chevron {
  flex: none;
  color: var(--fg-muted);
}

.fold-chevron {
  transition: transform var(--duration-fast) var(--ease-out);
}

.fold-chevron[data-open] {
  transform: rotate(90deg);
}

.fold-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-md);
  border: 0;
  background: none;
  color: var(--fg-secondary);
  font: inherit;
  font-size: var(--text-meta);
  cursor: pointer;
}

.fold-trigger:hover {
  color: var(--fg);
}

.fold-body {
  margin-block-start: var(--space-xs);
}

.list-empty {
  padding-block: var(--space-2xl);
}

.list-note {
  margin: 0;
  padding-inline: var(--space-md);
  color: var(--fg-muted);
  font-size: var(--text-meta);
}
</style>
