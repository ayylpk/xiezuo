<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { MessagePlugin } from "tdesign-vue-next";

import { useWorksStore, type Work } from "../stores/works";
import { useAuthStore } from "../stores/auth";
import { WORK_STATUS_TEXT } from "../constants";

const worksStore = useWorksStore();
const auth = useAuthStore();
const router = useRouter();

const dialogVisible = ref(false);
const newTitle = ref("");
const creating = ref(false);

onMounted(() => worksStore.fetchAll().catch((e) => MessagePlugin.error(e.message)));

async function onCreate() {
  if (!newTitle.value.trim()) {
    MessagePlugin.warning("书名不能为空");
    return;
  }
  creating.value = true;
  try {
    const { work } = await worksStore.create(newTitle.value.trim());
    MessagePlugin.success("作品已创建");
    router.push(`/works/${work.id}`);
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  } finally {
    creating.value = false;
    dialogVisible.value = false;
    newTitle.value = "";
  }
}

function statusTag(status: Work["status"]) {
  const map: Record<Work["status"], string> = { ongoing: "primary", finished: "success", shelved: "default" };
  return map[status];
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <span class="brand">写作台</span>
      <t-space>
        <t-button theme="primary" @click="dialogVisible = true">+ 新建作品</t-button>
        <t-button variant="text" @click="auth.logout(); router.push('/login')">退出</t-button>
      </t-space>
    </header>

    <main class="shelf">
      <h2 class="shelf-title">书架</h2>
      <div v-if="worksStore.works.length === 0 && worksStore.loaded" class="empty">还没有作品，点右上角新建</div>
      <t-grid :cols="4" :gutter="16" class="cards">
        <t-grid-item v-for="w in worksStore.works" :key="w.id">
          <t-card :title="w.title" hover-shadow @click="router.push(`/works/${w.id}`)" class="work-card">
            <template #actions>
              <t-tag :theme="statusTag(w.status)" variant="light">{{ WORK_STATUS_TEXT[w.status] }}</t-tag>
            </template>
            <p class="desc">{{ w.description || "（暂无简介）" }}</p>
            <t-space size="small">
              <t-tag variant="outline" theme="default">{{ w.chapterCount }} 章</t-tag>
              <t-tag variant="outline" theme="primary">{{ w.totalWords }} 字</t-tag>
            </t-space>
          </t-card>
        </t-grid-item>
      </t-grid>
    </main>

    <t-dialog v-model:visible="dialogVisible" header="新建作品" width="420" :footer="false" @closed="newTitle = ''">
      <t-input v-model="newTitle" placeholder="作品名" maxlength="128" @enter="onCreate" />
      <t-button block theme="primary" style="margin-top: 16px" :loading="creating" @click="onCreate">创建</t-button>
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
  padding: 16px 32px;
  background: #fff;
  border-bottom: 1px solid var(--td-component-stroke);
}
.brand {
  font-size: 20px;
  font-weight: 700;
}
.shelf {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 32px;
}
.shelf-title {
  margin: 0 0 20px;
}
.empty {
  padding: 80px 0;
  text-align: center;
  color: var(--td-text-color-placeholder);
}
.work-card {
  cursor: pointer;
}
.desc {
  min-height: 40px;
  color: var(--td-text-color-secondary);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>