<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { DialogPlugin, MessagePlugin } from "tdesign-vue-next";

import { FORESHADOW_STATUS, usePlanningStore, type Foreshadow } from "../stores/planning";
import { useChaptersStore } from "../stores/chapters";
import WorkShell from "../components/WorkShell.vue";
import EmptyState from "../components/EmptyState.vue";

const route = useRoute();
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

/** 状态 → 印章配色（open 未收=灯橙提醒 / closed 已收=豆绿 / dropped 遗忘=灰） */
const stampClass: Record<string, string> = { open: "xz-stamp--open", closed: "xz-stamp--closed", dropped: "xz-stamp--dropped" };

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

function confirmRemove(f: Foreshadow) {
  const dlg = DialogPlugin.confirm({
    header: "删除这条伏笔",
    body: f.content.length > 48 ? f.content.slice(0, 48) + "…" : f.content,
    theme: "warning",
    confirmBtn: { content: "确认删除", variant: "base" },
    onConfirm: async () => {
      try {
        await store.removeForeshadow(f.id);
        MessagePlugin.success("已删除");
        store.fetchForeshadows(workId);
      } catch (e) {
        MessagePlugin.error((e as Error).message);
      } finally {
        dlg.destroy();
      }
    },
  });
}

const chapterOptions = () => chapters.list.map((c) => ({ value: c.id, label: `${c.sortNo}. ${c.title}` }));
</script>

<template>
  <WorkShell>
    <template #actions>
      <t-button theme="primary" @click="openCreate">+ 新伏笔</t-button>
    </template>

    <section class="xz-panel">
      <EmptyState
        v-if="store.foreshadows.length === 0"
        title="台账还是空的"
        hint="埋下去的东西不记账，80 章后必然忘——现在记一条，将来少重读三万字"
      >
        <t-button theme="primary" @click="openCreate">记第一条伏笔</t-button>
      </EmptyState>

      <div v-else class="xz-rows">
        <div v-for="f in store.foreshadows" :key="f.id" class="xz-row fs">
          <span class="xz-stamp fs__stamp" :class="stampClass[f.status]">{{ FORESHADOW_STATUS[f.status] }}</span>
          <span class="fs__main">
            <span class="fs__content">{{ f.content }}</span>
            <span class="fs__track">
              埋 · <b>{{ chapterTitle(f.plantedChapterId) }}</b>
              <span class="fs__arrow">→</span>
              收 · <b>{{ chapterTitle(f.revealChapterId) }}</b>
            </span>
          </span>
          <t-select class="fs__status" :value="f.status" size="small" @change="(v: string) => setStatus(f, v)">
            <t-option v-for="(label, key) in FORESHADOW_STATUS" :key="key" :value="key" :label="label" />
          </t-select>
          <t-button variant="text" size="small" @click="openEdit(f)">编辑</t-button>
          <t-button variant="text" theme="danger" size="small" @click="confirmRemove(f)">删除</t-button>
        </div>
      </div>
    </section>

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
  </WorkShell>
</template>

<style scoped>
/* 行首状态印章（颜色由 stampClass 指定）：不被长文挤变形 */
.fs__stamp {
  flex-shrink: 0;
}
.fs__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.fs__content {
  font-size: var(--xz-text-body);
  color: var(--xz-ink);
  line-height: 1.55;
}
.fs__track {
  font-size: var(--xz-text-xs);
  color: var(--xz-ink-3);
}
.fs__track b {
  color: var(--xz-ink-2);
  font-weight: 500;
}
.fs__arrow {
  margin: 0 8px;
  color: var(--xz-lamp);
}
.fs__status {
  width: 96px;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .fs__track {
    display: none;
  }
}
</style>
