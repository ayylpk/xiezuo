<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { MessagePlugin } from "tdesign-vue-next";

import { api } from "../api/client";

interface SearchHit {
  kind: string;
  id: number;
  workId: number;
  title: string;
  snippet: string;
}

/** 类型 → 标签/主题色（后端 title 自带【类型】前缀，渲染时拆出来单放 tag） */
const KIND_META: Record<string, { label: string; theme: string }> = {
  chapter: { label: "章节", theme: "primary" },
  entity: { label: "设定", theme: "success" },
  outline: { label: "大纲", theme: "warning" },
  foreshadow: { label: "伏笔", theme: "danger" },
  timeline: { label: "时间线", theme: "neutral" },
  note: { label: "随笔", theme: "info" },
};

const route = useRoute();
const router = useRouter();

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
  if (keyword.value) runSearch();
});

/** 拆分【类型】标题前缀，tag 单独展示 */
function display(h: SearchHit) {
  const m = h.title.match(/^【(.+?)】(.*)$/);
  const meta = KIND_META[h.kind] ?? { label: m?.[1] ?? h.kind, theme: "default" };
  return { ...h, tag: meta.label, theme: meta.theme, title: m?.[2] || h.title };
}

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
    <header class="topbar">
      <t-button variant="text" @click="router.push('/')">← 书架</t-button>
      <span class="title">全局搜索</span>
      <span class="spacer" />
      <t-input
        v-model="keyword"
        class="kw"
        placeholder="搜章节 / 设定 / 大纲 / 伏笔 / 时间线 / 随笔…"
        clearable
        @enter="runSearch"
      >
        <template #suffixIcon>
          <t-button theme="primary" variant="text" :loading="searching" @click="runSearch">搜索</t-button>
        </template>
      </t-input>
    </header>

    <main class="body">
      <div v-if="!searched" class="empty">输入关键词回车，跨全书检索（章节正文、简情、设定、大纲、伏笔、时间线、随笔）</div>
      <div v-else-if="hits.length === 0" class="empty">没有命中「{{ keyword }}」</div>
      <t-list v-else>
        <t-list-item v-for="h in hits" :key="`${h.kind}-${h.id}`" class="hit" @click="goTo(h)">
          <t-tag :theme="display(h).theme" variant="light">{{ display(h).tag }}</t-tag>
          <div class="main">
            <div class="line1">
              <b>{{ display(h).title }}</b>
              <span class="work">作品 #{{ h.workId }}</span>
            </div>
            <div class="snippet">{{ h.snippet || "（命中标题）" }}</div>
          </div>
        </t-list-item>
      </t-list>
    </main>
  </div>
</template>

<style scoped>
.page {
  min-height: 100%;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 32px;
  background: #fff;
  border-bottom: 1px solid var(--td-component-stroke);
}
.title {
  font-weight: 600;
}
.spacer {
  flex: 1;
}
.kw {
  width: 440px;
}
.body {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 32px;
}
.empty {
  padding: 80px 0;
  text-align: center;
  color: var(--td-text-color-placeholder);
}
.hit {
  cursor: pointer;
  align-items: flex-start;
  padding: 10px 8px;
}
.main {
  flex: 1;
  margin-left: 12px;
  min-width: 0;
}
.line1 {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}
.work {
  color: var(--td-text-color-placeholder);
  font-size: 12px;
}
.snippet {
  margin-top: 4px;
  color: var(--td-text-color-secondary);
  font-size: 13px;
  line-height: 1.6;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>