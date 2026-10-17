<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { MessagePlugin } from "tdesign-vue-next";

import { usePlanningStore, type TimelineEvent } from "../stores/planning";
import { useChaptersStore } from "../stores/chapters";

const route = useRoute();
const router = useRouter();
const store = usePlanningStore();
const chapters = useChaptersStore();
const workId = Number(route.params.id);

const dialogVisible = ref(false);
const editId = ref<number | null>(null);
const form = ref({ storyTime: "", event: "", chapterId: null as number | null });

onMounted(async () => {
  try {
    await Promise.all([store.fetchTimeline(workId), chapters.fetchList(workId)]);
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
});

function openCreate() {
  editId.value = null;
  Object.assign(form.value, { storyTime: "", event: "", chapterId: null });
  dialogVisible.value = true;
}

function openEdit(ev: TimelineEvent) {
  editId.value = ev.id;
  Object.assign(form.value, { storyTime: ev.storyTime, event: ev.event, chapterId: ev.chapterId });
  dialogVisible.value = true;
}

async function save() {
  if (!form.value.storyTime.trim() || !form.value.event.trim()) {
    MessagePlugin.warning("时间和事件不能为空");
    return;
  }
  try {
    if (editId.value) {
      await store.updateEvent(editId.value, { ...form.value, storyTime: form.value.storyTime.trim(), event: form.value.event.trim() });
    } else {
      await store.createEvent({ ...form.value, storyTime: form.value.storyTime.trim(), event: form.value.event.trim() });
    }
    MessagePlugin.success(editId.value ? "已保存" : "已记录");
    dialogVisible.value = false;
    store.fetchTimeline(workId);
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}

async function removeEvent(ev: TimelineEvent) {
  if (!window.confirm("删除这条时间线事件？")) return;
  try {
    await store.removeEvent(ev.id);
    store.fetchTimeline(workId);
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}

const chapterLabel = (id: number | null) => (id == null ? null : chapters.list.find((c) => c.id === id)?.title ?? `#${id}`);
const chapterOptions = () => chapters.list.map((c) => ({ value: c.id, label: `${c.sortNo}. ${c.title}` }));
</script>

<template>
  <div class="page">
    <header class="topbar">
      <t-button variant="text" @click="router.push(`/works/${workId}`)">← 作品</t-button>
      <span class="title">故事时间线</span>
      <t-button theme="primary" @click="openCreate">+ 记录事件</t-button>
    </header>

    <main class="body">
      <div v-if="store.timeline.length === 0" class="empty">时间轴空着——写第 40 章时你一定会回来看第 3 章"现在是第几天"</div>

      <div class="axis">
        <div v-for="ev in store.timeline" :key="ev.id" class="axis-item">
          <div class="dot" />
          <div class="card">
            <div class="row">
              <t-tag theme="primary" variant="light">{{ ev.storyTime }}</t-tag>
              <span class="event">{{ ev.event }}</span>
              <t-tag v-if="chapterLabel(ev.chapterId)" variant="outline" size="small" class="ch-tag">
                第 {{ chapterLabel(ev.chapterId)?.split(".")[0] }} 章
              </t-tag>
              <t-space>
                <t-button variant="text" size="small" @click="openEdit(ev)">编</t-button>
                <t-button variant="text" theme="danger" size="small" @click="removeEvent(ev)">删</t-button>
              </t-space>
            </div>
          </div>
        </div>
      </div>
    </main>

    <t-dialog v-model:visible="dialogVisible" :header="editId ? '编辑事件' : '记录事件'" width="520" :footer="false">
      <t-form label-align="top">
        <t-form-item label="故事内时间（自由文本）">
          <t-input v-model="form.storyTime" placeholder="如：第 3 年冬 / 开学第二天" maxlength="64" />
        </t-form-item>
        <t-form-item label="发生了什么">
          <t-textarea v-model="form.event" :autosize="{ minRows: 2 }" maxlength="4000" placeholder="谁在哪、做了什么、影响了什么…" />
        </t-form-item>
        <t-form-item label="关联章节（可选）">
          <t-select v-model="form.chapterId" :options="chapterOptions()" clearable placeholder="不关联" />
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
}
.axis {
  position: relative;
  padding-left: 24px;
  border-left: 2px solid var(--td-brand-color-3, #ccc);
}
.axis-item {
  position: relative;
  padding: 8px 0 20px;
}
.dot {
  position: absolute;
  left: -31px;
  top: 14px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--td-brand-color);
  border: 2px solid #fff;
  box-shadow: 0 0 0 2px var(--td-brand-color-3, #ccc);
}
.card {
  background: #fff;
  border-radius: 8px;
  padding: 10px 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.event {
  flex: 1;
}
.ch-tag {
  margin-right: 4px;
}
.empty {
  padding: 60px 0;
  text-align: center;
  color: var(--td-text-color-placeholder);
}
</style>