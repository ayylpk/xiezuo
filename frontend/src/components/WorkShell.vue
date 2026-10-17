<script setup lang="ts">
/**
 * 作品内壳：作品 7 个子页（概览/章节/设定/大纲/伏笔/时间线/随笔）共用。
 * 顶栏（返回书架 + 作品名 + 状态印章 + 页面动作 slot）+ 七页签导航 + 内容区。
 * 取代此前每页各自手写顶栏、只有"← 作品"回链的割裂导航。
 */
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";

import DeskHeader from "./DeskHeader.vue";
import { WORK_STATUS_TEXT } from "../constants";
import { useWorksStore } from "../stores/works";

const route = useRoute();
const worksStore = useWorksStore();
const workId = Number(route.params.id);

onMounted(() => {
  if (!worksStore.loaded) worksStore.fetchAll().catch(() => {});
});

const work = computed(() => worksStore.works.find((w) => w.id === workId) ?? null);

const stampClass = computed(() => {
  switch (work.value?.status) {
    case "finished": return "xz-stamp--finished";
    case "shelved": return "xz-stamp--shelved";
    default: return "xz-stamp--ongoing";
  }
});
</script>

<template>
  <div class="work-shell">
    <DeskHeader back-to="/" back-label="书架">
      <template #center>
        <span class="work-shell__title" :title="work?.title">{{ work?.title ?? "…" }}</span>
        <span v-if="work" class="xz-stamp" :class="stampClass">{{ WORK_STATUS_TEXT[work.status] }}</span>
      </template>
      <template #actions>
        <slot name="actions" />
      </template>
    </DeskHeader>

    <nav class="work-nav">
      <router-link :to="`/works/${workId}`" exact-active-class="active">概览</router-link>
      <router-link :to="`/works/${workId}/chapters`" active-class="active">章节</router-link>
      <router-link :to="`/works/${workId}/entities`" active-class="active">设定库</router-link>
      <router-link :to="`/works/${workId}/outlines`" active-class="active">大纲</router-link>
      <router-link :to="`/works/${workId}/foreshadows`" active-class="active">伏笔</router-link>
      <router-link :to="`/works/${workId}/timeline`" active-class="active">时间线</router-link>
      <router-link :to="`/works/${workId}/notes`" active-class="active">随笔</router-link>
    </nav>

    <main class="work-body">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.work-shell {
  min-height: 100%;
}
.work-shell__title {
  font-size: 17px;
  font-weight: 600;
  color: var(--xz-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 360px;
}

/* 七页签：下划线导航，激活豆绿 */
.work-nav {
  display: flex;
  gap: 2px;
  padding: 0 28px;
  background: var(--xz-panel);
  border-bottom: 1px solid var(--xz-line);
}
.work-nav a {
  padding: 9px 14px;
  color: var(--xz-ink-2);
  text-decoration: none;
  font-size: var(--xz-text-sm);
  letter-spacing: 0.06em;
  border-bottom: 2px solid transparent;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.work-nav a:hover {
  color: var(--xz-ink);
}
.work-nav a.active {
  color: var(--xz-green);
  border-bottom-color: var(--xz-green);
  font-weight: 600;
}

.work-body {
  max-width: 1080px;
  margin: 0 auto;
  padding: 26px 28px 64px;
}
</style>
