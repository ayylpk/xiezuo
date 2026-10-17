<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { MessagePlugin } from "tdesign-vue-next";

import { CHAPTER_STATUS, useChaptersStore } from "../stores/chapters";

const route = useRoute();
const router = useRouter();
const store = useChaptersStore();
const workId = Number(route.params.id);

const creating = ref(false);

onMounted(() => store.fetchList(workId).catch((e) => MessagePlugin.error(e.message)));

async function onAdd() {
  creating.value = true;
  try {
    const { chapter } = await store.create(workId);
    router.push(`/works/${workId}/chapters/${chapter.id}`);
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  } finally {
    creating.value = false;
  }
}

async function onStatusChange(chapterId: number, status: string) {
  try {
    await store.setStatus(chapterId, status as keyof typeof CHAPTER_STATUS);
    MessagePlugin.success("状态已更新");
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}

async function onDelete(chapter: { id: number; title: string }) {
  if (!window.confirm(`删除《${chapter.title}》？正文不可恢复`)) return;
  try {
    await store.remove(chapter.id);
    MessagePlugin.success("已删除");
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <t-button variant="text" @click="router.push(`/works/${workId}`)">← 作品</t-button>
      <span class="title">章节</span>
      <t-button theme="primary" :loading="creating" @click="onAdd">+ 新章节</t-button>
    </header>

    <main class="body">
      <div v-if="store.list.length === 0" class="empty">还没有章节，点右上角新建</div>

      <t-list v-else>
        <t-list-item v-for="ch in store.list" :key="ch.id">
          <span class="ch-index">{{ ch.sortNo }}</span>
          <span class="ch-title" @click="router.push(`/works/${workId}/chapters/${ch.id}`)">
            {{ ch.title }} <span class="ch-synopsis">{{ ch.synopsis }}</span>
          </span>
          <span class="ch-words">{{ ch.wordCount }} 字</span>
          <t-select
            class="status-sel"
            :value="ch.status"
            size="small"
            @change="(v: string) => onStatusChange(ch.id, v)"
          >
            <t-option v-for="(label, key) in CHAPTER_STATUS" :key="key" :value="key" :label="label" />
          </t-select>
          <t-button variant="text" theme="danger" size="small" @click="onDelete(ch)">删</t-button>
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
  justify-content: space-between;
  align-items: center;
  padding: 12px 32px;
  background: #fff;
  border-bottom: 1px solid var(--td-component-stroke);
}
.title {
  font-weight: 600;
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
.ch-index {
  min-width: 32px;
  color: var(--td-text-color-placeholder);
}
.ch-title {
  flex: 1;
  cursor: pointer;
}
.ch-synopsis {
  margin-left: 12px;
  color: var(--td-text-color-placeholder);
  font-size: 12px;
}
.ch-words {
  color: var(--td-text-color-placeholder);
  margin: 0 16px;
}
.status-sel {
  width: 110px;
  margin-right: 8px;
}
</style>