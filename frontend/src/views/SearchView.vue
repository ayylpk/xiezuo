<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { MessagePlugin } from "tdesign-vue-next";

import { api } from "../api/client";
import { useWorksStore } from "../stores/works";
import DeskHeader from "../components/DeskHeader.vue";
import EmptyState from "../components/EmptyState.vue";

interface SearchHit {
  kind: string;
  id: number;
  workId: number;
  title: string;
  snippet: string;
}

/** 类型 → 印章文案（后端 title 自带【类型】前缀，渲染时拆出来单放印章） */
const KIND_LABEL: Record<string, string> = {
  chapter: "章节",
  entity: "设定",
  outline: "大纲",
  foreshadow: "伏笔",
  timeline: "时间线",
  note: "随笔",
};

const route = useRoute();
const router = useRouter();
const worksStore = useWorksStore();

const keyword = ref(typeof route.query.q === "string" ? route.query.q : "");
const hits = ref<SearchHit[]>([]);
const searched = ref(false);
const searching = ref(false);

async function runSearch() {
  const q = keyword.value.trim();
  if (!q) {
    MessagePlugin.warning("输入关键词");
    return;
  }
  searching.value = true;
  searched.value = true;
  try {
    const { hits: list } = await api.get<{ hits: SearchHit[] }>(`/search?q=${encodeURIComponent(q)}`);
    hits.value = list;
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  } finally {
    searching.value = false;
  }
}

onMounted(() => {
  if (!worksStore.loaded) worksStore.fetchAll().catch(() => {}); // 结果行要显示书名而非 #id
  if (keyword.value) runSearch();
});

/** 拆分【类型】标题前缀，印章单独展示（伏笔/时间线无标题字段，正文命中如实标注） */
function display(h: SearchHit) {
  const m = h.title.match(/^【(.+?)】(.*)$/);
  const rest = (m?.[2] ?? h.title).trim();
  return { ...h, tag: KIND_LABEL[h.kind] ?? m?.[1] ?? h.kind, title: rest || "（命中的是正文）" };
}

const workTitle = (id: number) => worksStore.works.find((w) => w.id === id)?.title ?? `作品 #${id}`;

/** 点击结果 → 跳对应页（章节直达编辑器，其余跳列表页） */
function goTo(h: SearchHit) {
  const base = `/works/${h.workId}`;
  if (h.kind === "chapter") router.push(`${base}/chapters/${h.id}`);
  else if (h.kind === "entity") router.push(`${base}/entities`);
  else if (h.kind === "outline") router.push(`${base}/outlines`);
  else if (h.kind === "foreshadow") router.push(`${base}/foreshadows`);
  else if (h.kind === "timeline") router.push(`${base}/timeline`);
  else router.push(`${base}/notes`);
}
</script>

<template>
  <div class="page">
    <DeskHeader back-to="/" back-label="书架">
      <template #center><span class="page__name">全局搜索</span></template>
    </DeskHeader>

    <main class="body">
      <!-- 主场景：一口大搜索井 -->
      <div class="well">
        <h1 v-if="!searched" class="well__hello xz-display">跨全书检索</h1>
        <t-input
          v-model="keyword"
          class="well__input"
          size="large"
          placeholder="章节 / 设定 / 大纲 / 伏笔 / 时间线 / 随笔…"
          clearable
          @enter="runSearch"
        >
          <template #suffixIcon>
            <t-button theme="primary" variant="text" :loading="searching" @click="runSearch">搜索</t-button>
          </template>
        </t-input>
        <p v-if="!searched" class="well__hint">正文、简情、设定、大纲全在一个入口里，回车即搜</p>
        <p v-else class="well__count">命中 <b>{{ hits.length }}</b> 条</p>
      </div>

      <!-- 未搜：指路空态 -->
      <EmptyState
        v-if="!searched"
        title="想找哪一句？"
        hint="比如某个角色的口头禅、某条还没收的伏笔、上次写到哪卡住了——搜比翻快"
      />

      <!-- 搜了没中 -->
      <EmptyState
        v-else-if="hits.length === 0"
        :title="`没有命中「${keyword}」`"
        hint="换个更短的词试试——搜索按字面匹配，两个字的关键词比一整句话更容易中"
      />

      <!-- 结果 -->
      <section v-else class="xz-panel results">
        <div class="xz-rows">
          <div
            v-for="h in hits"
            :key="`${h.kind}-${h.id}`"
            class="xz-row hit"
            tabindex="0"
            @click="goTo(h)"
            @keydown.enter="goTo(h)"
          >
            <span class="xz-stamp hit__kind">{{ display(h).tag }}</span>
            <div class="hit__main">
              <div class="hit__line1">
                <span class="hit__title">{{ display(h).title }}</span>
                <span class="hit__work">{{ workTitle(h.workId) }}</span>
              </div>
              <p class="hit__snippet">{{ h.snippet || "（命中标题）" }}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.page {
  min-height: 100%;
  background: var(--xz-wall);
}
.page__name {
  font-size: 17px;
  font-weight: 600;
  color: var(--xz-ink);
}
.body {
  max-width: 860px;
  margin: 0 auto;
  padding: 40px 28px 80px;
}

/* 搜索井 */
.well {
  text-align: center;
  margin-bottom: 30px;
}
.well__hello {
  margin: 0 0 18px;
  font-size: var(--xz-text-brand);
  font-weight: 700;
  color: var(--xz-ink);
  letter-spacing: 0.12em;
}
.well__input {
  max-width: 640px;
  margin: 0 auto;
  text-align: left;
}
.well__input :deep(.t-input) {
  border-radius: var(--td-radius-large);
  padding: 4px 6px;
}
.well__hint {
  margin: 12px 0 0;
  color: var(--xz-ink-3);
  font-size: var(--xz-text-sm);
}
.well__count {
  margin: 12px 0 0;
  color: var(--xz-ink-2);
  font-size: var(--xz-text-sm);
}
.well__count b {
  color: var(--xz-lamp);
  font-size: var(--xz-text-h3);
  font-variant-numeric: tabular-nums;
}

/* 结果行 */
.results {
  overflow: hidden;
}
.hit {
  cursor: pointer;
  align-items: flex-start;
  outline: none;
}
.hit__kind {
  flex-shrink: 0;
  margin-top: 3px;
  color: var(--xz-ink-2);
}
.hit__main {
  flex: 1;
  min-width: 0;
}
.hit__line1 {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}
.hit__title {
  font-family: "STKaiti", "KaiTi", "Noto Serif SC", serif;
  font-size: var(--xz-text-h3);
  color: var(--xz-ink);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hit:hover .hit__title {
  color: var(--xz-green);
}
.hit:focus-visible {
  background: var(--xz-panel-2);
}
.hit__work {
  flex-shrink: 0;
  color: var(--xz-ink-3);
  font-size: var(--xz-text-xs);
}
.hit__snippet {
  margin: 4px 0 0;
  color: var(--xz-ink-2);
  font-size: var(--xz-text-sm);
  line-height: 1.6;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

@media (max-width: 640px) {
  .well__hello {
    font-size: var(--xz-text-title);
  }
  .hit__work {
    display: none;
  }
}
</style>
