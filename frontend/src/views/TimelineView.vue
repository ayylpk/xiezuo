<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { DialogPlugin, MessagePlugin } from "tdesign-vue-next";

import { usePlanningStore, type TimelineEvent } from "../stores/planning";
import { useChaptersStore } from "../stores/chapters";
import WorkShell from "../components/WorkShell.vue";
import EmptyState from "../components/EmptyState.vue";

const route = useRoute();
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

function confirmRemove(ev: TimelineEvent) {
  const dlg = DialogPlugin.confirm({
    header: "删除这条时间线事件",
    body: `${ev.storyTime} · ${ev.event.length > 40 ? ev.event.slice(0, 40) + "…" : ev.event}`,
    theme: "warning",
    confirmBtn: { content: "确认删除", variant: "base" },
    onConfirm: async () => {
      try {
        await store.removeEvent(ev.id);
        MessagePlugin.success("已删除");
        store.fetchTimeline(workId);
      } catch (e) {
        MessagePlugin.error((e as Error).message);
      } finally {
        dlg.destroy();
      }
    },
  });
}

/** 关联章节：徽标显示"第 N 章"（取 sortNo），hover 看标题 */
const chapterNo = (id: number | null) => (id == null ? null : chapters.list.find((c) => c.id === id)?.sortNo ?? null);
const chapterTitle = (id: number | null) => (id == null ? "" : chapters.list.find((c) => c.id === id)?.title ?? `#${id}`);
const chapterOptions = () => chapters.list.map((c) => ({ value: c.id, label: `${c.sortNo}. ${c.title}` }));
</script>

<template>
  <WorkShell>
    <template #actions>
      <t-button theme="primary" @click="openCreate">+ 记录事件</t-button>
    </template>

    <div v-if="store.timeline.length === 0">
      <EmptyState
        title="时间轴空着"
        hint="写第 40 章时，你一定会回来看第 3 章「现在是第几天」——到那天之前，先把轴立起来"
      >
        <t-button theme="primary" @click="openCreate">记第一个事件</t-button>
      </EmptyState>
    </div>

    <!-- 时间轴：一条灯芯竖线，节点是线上的珠子 -->
    <div v-else class="axis">
      <div v-for="ev in store.timeline" :key="ev.id" class="axis__item">
        <span class="axis__dot" aria-hidden="true" />
        <div class="axis__card xz-panel">
          <span class="axis__time">{{ ev.storyTime }}</span>
          <span class="axis__event">{{ ev.event }}</span>
          <span v-if="chapterNo(ev.chapterId) !== null" class="axis__ch" :title="chapterTitle(ev.chapterId)">第 {{ chapterNo(ev.chapterId) }} 章</span>
          <span class="axis__ops">
            <t-button variant="text" size="small" @click="openEdit(ev)">编辑</t-button>
            <t-button variant="text" theme="danger" size="small" @click="confirmRemove(ev)">删除</t-button>
          </span>
        </div>
      </div>
    </div>

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
  </WorkShell>
</template>

<style scoped>
.axis {
  position: relative;
  padding-left: 26px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
/* 灯芯竖线 */
.axis::before {
  content: "";
  position: absolute;
  left: 5px;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: linear-gradient(180deg, var(--xz-lamp-glow), var(--xz-line-2) 12%, var(--xz-line-2) 88%, transparent);
}

.axis__item {
  position: relative;
}
/* 节点珠：灯橙芯 + 壁色环，压在轴线上 */
.axis__dot {
  position: absolute;
  left: -26px;
  top: 15px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--xz-lamp);
  box-shadow: 0 0 0 3px var(--xz-wall), 0 0 10px var(--xz-lamp-glow);
}

.axis__card {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 12px 16px;
}
/* 故事内时间：楷体徽标，本行唯一强调 */
.axis__time {
  flex-shrink: 0;
  font-family: "STKaiti", "KaiTi", "Noto Serif SC", serif;
  font-size: var(--xz-text-sm);
  color: var(--xz-lamp);
  border: 1px solid var(--xz-lamp);
  border-radius: var(--td-radius-small);
  padding: 1px 8px;
  white-space: nowrap;
}
.axis__event {
  flex: 1;
  min-width: 0;
  color: var(--xz-ink);
  line-height: 1.6;
}
.axis__ch {
  flex-shrink: 0;
  font-size: var(--xz-text-xs);
  color: var(--xz-ink-2);
  font-variant-numeric: tabular-nums;
}
.axis__ops {
  flex-shrink: 0;
  display: flex;
  gap: 2px;
}

@media (max-width: 640px) {
  .axis__ch {
    display: none;
  }
}
</style>
