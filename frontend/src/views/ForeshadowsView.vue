<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { MessagePlugin } from "tdesign-vue-next";

import { FORESHADOW_STATUS, usePlanningStore, type Foreshadow } from "../stores/planning";
import { useChaptersStore } from "../stores/chapters";

const route = useRoute();
const router = useRouter();
const store = usePlanningStore();
const chapters = useChaptersStore();
const workId = Number(route.params.id);

const dialogVisible = ref(false);
const editId = ref<number | null>(null);
const form = ref({ content: "", plantedChapterId: null as number | null, revealChapterId: null as number | null });

onMounted(async () => {
  try {
    await Promise.all([store.fetchForeshadows(workId), chapters.fetchList(workId)]);
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
});

const statusTheme: Record<string, string> = { open: "warning", closed: "success", dropped: "default" };

function openCreate() {
  editId.value = null;
  Object.assign(form.value, { content: "", plantedChapterId: null, revealChapterId: null });
  dialogVisible.value = true;
}

function openEdit(f: Foreshadow) {
  editId.value = f.id;
  Object.assign(form.value, { content: f.content, plantedChapterId: f.plantedChapterId, revealChapterId: f.revealChapterId });
  dialogVisible.value = true;
}

function chapterTitle(id: number | null) {
  return id == null ? "—" : (chapters.list.find((c) => c.id === id)?.title ?? `#${id}`);
}

async function save() {
  if (!form.value.content.trim()) {
    MessagePlugin.warning("内容不能为空");
    return;
  }
  try {
    if (editId.value) {
      await store.updateForeshadow(editId.value, {
        content: form.value.content.trim(),
        plantedChapterId: form.value.plantedChapterId,
        revealChapterId: form.value.revealChapterId,
      });
    } else {
      await store.createForeshadow({
        content: form.value.content.trim(),
        plantedChapterId: form.value.plantedChapterId,
        revealChapterId: form.value.revealChapterId,
      });
    }
    MessagePlugin.success(editId.value ? "已保存" : "已建档");
    dialogVisible.value = false;
    store.fetchForeshadows(workId);
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}

async function setStatus(f: Foreshadow, status: string) {
  try {
    await store.updateForeshadow(f.id, { status: status as Foreshadow["status"] });
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}

async function removeForeshadow(f: Foreshadow) {
  if (!window.confirm("删除这条伏笔？")) return;
  try {
    await store.removeForeshadow(f.id);
    store.fetchForeshadows(workId);
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}

const chapterOptions = () => chapters.list.map((c) => ({ value: c.id, label: `${c.sortNo}. ${c.title}` }));
</script>

<template>
  <div class="page">
    <header class="topbar">
      <t-button variant="text" @click="router.push(`/works/${workId}`)">← 作品</t-button>
      <span class="title">伏笔台账</span>
      <t-button theme="primary" @click="openCreate">+ 新伏笔</t-button>
    </header>

    <main class="body">
      <div v-if="store.foreshadows.length === 0" class="empty">还没有伏笔——埋下去的东西不记账，80 章后必然忘</div>
      <t-card v-for="f in store.foreshadows" :key="f.id" class="fs-card" :bordered="false">
        <div class="row">
          <t-tag :theme="statusTheme[f.status]" variant="light">{{ FORESHADOW_STATUS[f.status] }}</t-tag>
          <span class="content">{{ f.content }}</span>
          <t-space>
            <t-select
              class="status-sel"
              :value="f.status"
              size="small"
              @change="(v: string) => setStatus(f, v)"
            >
              <t-option v-for="(label, key) in FORESHADOW_STATUS" :key="key" :value="key" :label="label" />
            </t-select>
            <t-button variant="text" size="small" @click="openEdit(f)">编</t-button>
            <t-button variant="text" theme="danger" size="small" @click="removeForeshadow(f)">删</t-button>
          </t-space>
        </div>
        <div class="meta">
          埋设：<b>{{ chapterTitle(f.plantedChapterId) }}</b>
          <t-tag variant="outline" size="small" theme="warning" style="margin: 0 8px">→</t-tag>
          回收：<b>{{ chapterTitle(f.revealChapterId) }}</b>
        </div>
      </t-card>
    </main>

    <t-dialog v-model:visible="dialogVisible" :header="editId ? '编辑伏笔' : '新伏笔'" width="520" :footer="false">
      <t-form label-align="top">
        <t-form-item label="伏笔内容（是什么、计划怎么收）">
          <t-textarea v-model="form.content" :autosize="{ minRows: 2 }" maxlength="4000" />
        </t-form-item>
        <t-form-item label="埋设章节">
          <t-select v-model="form.plantedChapterId" :options="chapterOptions()" clearable placeholder="暂未埋" />
        </t-form-item>
        <t-form-item label="回收章节">
          <t-select v-model="form.revealChapterId" :options="chapterOptions()" clearable placeholder="计划在哪收" />
        </t-form-item>
        <t-button block theme="primary" @click="save">保存</t-button>
      </t-form>
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
.title {
  font-weight: 600;
}
.body {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.fs-card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.content {
  flex: 1;
}
.status-sel {
  width: 96px;
}
.meta {
  margin-top: 10px;
  color: var(--td-text-color-secondary);
  font-size: 13px;
}
.empty {
  padding: 60px 0;
  text-align: center;
  color: var(--td-text-color-placeholder);
}
</style>