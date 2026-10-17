<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { MessagePlugin, Popup } from "tdesign-vue-next";

import { api } from "../api/client";
import { WORK_STATUS_TEXT } from "../constants";
import { useWorksStore } from "../stores/works";

const route = useRoute();
const router = useRouter();
const worksStore = useWorksStore();
const workId = Number(route.params.id);

const work = ref<(typeof worksStore.works)[number] | null>(null);
const detail = ref<{
  id: number;
  title: string;
  description: string;
  status: string;
  chapterCount: number;
  totalWords: number;
  chapters: { id: number; title: string; status: string; wordCount: number; sortNo: number }[];
} | null>(null);

const editing = ref(false);
const editTitle = ref("");
const editDesc = ref("");

async function load() {
  try {
    const { work: d } = await api.get<{ work: typeof detail.value }>(`/works/${workId}`);
    detail.value = d;
    work.value = worksStore.works.find((w) => w.id === workId) ?? null;
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}

onMounted(load);

const statusText = computed(
  () => (detail.value ? WORK_STATUS_TEXT[detail.value.status] : ""),
);

function startEdit() {
  editing.value = true;
  editTitle.value = detail.value!.title;
  editDesc.value = detail.value!.description;
}

async function saveEdit() {
  try {
    await worksStore.update(workId, { title: editTitle.value, description: editDesc.value });
    MessagePlugin.success("已保存");
    editing.value = false;
    load();
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}

async function removeWork() {
  try {
    await worksStore.remove(workId);
    MessagePlugin.success("已删除");
    router.push("/");
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <t-button variant="text" @click="router.push('/')">← 书架</t-button>
      <t-tag v-if="detail" theme="primary" variant="light">{{ statusText }}</t-tag>
      <t-space>
        <t-button theme="primary" @click="router.push(`/works/${workId}/chapters`)">写章节</t-button>
        <Popup content="删除整个作品（章节一并删除）">
          <t-button theme="danger" variant="outline" @click="removeWork">删除</t-button>
        </Popup>
      </t-space>
    </header>

    <nav class="subnav" v-if="detail">
      <router-link :to="`/works/${workId}`" exact-active-class="active">概览</router-link>
      <router-link :to="`/works/${workId}/chapters`" active-class="active">章节</router-link>
      <router-link :to="`/works/${workId}/entities`" active-class="active">设定库</router-link>
      <router-link :to="`/works/${workId}/outlines`" active-class="active">大纲</router-link>
      <router-link :to="`/works/${workId}/foreshadows`" active-class="active">伏笔</router-link>
      <router-link :to="`/works/${workId}/timeline`" active-class="active">时间线</router-link>
    </nav>

    <main v-if="detail" class="body">
      <h1 class="title">{{ detail.title }}</h1>
      <t-space size="small" class="stats">
        <t-tag variant="outline">{{ detail.chapterCount }} 章</t-tag>
        <t-tag variant="outline" theme="primary">{{ detail.totalWords.toLocaleString() }} 字</t-tag>
      </t-space>
      <p class="desc">{{ detail.description || "（暂无简介，点右上角「编辑」补充）" }}</p>
      <t-button variant="text" @click="startEdit">编辑信息</t-button>

      <h3 class="section">章节概览</h3>
      <div v-if="detail.chapters.length === 0" class="empty">还没有章节，点右上角「写章节」开始</div>
      <t-list v-else>
        <t-list-item v-for="ch in detail.chapters" :key="ch.id" @click="router.push(`/works/${workId}/chapters/${ch.id}`)">
          <span class="ch-index">{{ ch.sortNo }}</span>
          <span class="ch-title">{{ ch.title }}</span>
          <t-tag variant="light" theme="warning" v-if="ch.status === 'review'">待审查</t-tag>
          <t-tag variant="light" theme="success" v-else-if="ch.status === 'final'">已定稿</t-tag>
          <span class="ch-words">{{ ch.wordCount }} 字</span>
        </t-list-item>
      </t-list>
    </main>

    <t-dialog v-model:visible="editing" header="编辑作品信息" width="480" :footer="false">
      <t-input v-model="editTitle" label="书名" maxlength="128" style="margin-bottom: 16px" />
      <t-textarea v-model="editDesc" label="简介" :autosize="{ minRows: 3 }" maxlength="2000" />
      <t-button block theme="primary" style="margin-top: 16px" @click="saveEdit">保存</t-button>
    </t-dialog>
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
.subnav {
  display: flex;
  gap: 4px;
  padding: 0 32px;
  background: #fff;
  border-bottom: 1px solid var(--td-component-stroke);
}
.subnav a {
  padding: 10px 14px;
  color: var(--td-text-color-secondary);
  text-decoration: none;
  border-bottom: 2px solid transparent;
}
.subnav a.active {
  color: var(--td-brand-color);
  border-bottom-color: var(--td-brand-color);
  font-weight: 600;
}
.body {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px;
}
.title {
  margin: 0 0 12px;
}
.stats {
  margin-bottom: 8px;
}
.desc {
  color: var(--td-text-color-secondary);
  margin: 8px 0;
}
.section {
  margin-top: 40px;
}
.empty {
  padding: 48px 0;
  color: var(--td-text-color-placeholder);
}
.ch-index {
  display: inline-block;
  min-width: 32px;
  color: var(--td-text-color-placeholder);
}
.ch-title {
  flex: 1;
}
.ch-words {
  color: var(--td-text-color-placeholder);
  margin-left: 16px;
}
</style>