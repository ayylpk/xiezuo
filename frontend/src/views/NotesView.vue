<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { DialogPlugin, MessagePlugin } from "tdesign-vue-next";
import { marked } from "marked";
import DOMPurify from "dompurify";

import { NOTE_TYPES, useNotesStore, type Note, type NoteType } from "../stores/notes";
import WorkShell from "../components/WorkShell.vue";
import EmptyState from "../components/EmptyState.vue";

const route = useRoute();
const store = useNotesStore();
const workId = Number(route.params.id);

const activeType = ref<NoteType>("note");
const dialogVisible = ref(false);
const editId = ref<number | null>(null);
const form = ref({ title: "", content: "" });

onMounted(async () => {
  try {
    await store.fetchList(workId);
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
});

/** tab 过滤在当前作品内做 */
const filtered = computed(() => store.list.filter((n) => n.type === activeType.value));

function renderMd(text: string) {
  return DOMPurify.sanitize(marked.parse(text) as string);
}

function openCreate(type: NoteType) {
  editId.value = null;
  activeType.value = type;
  form.value = { title: "", content: "" };
  dialogVisible.value = true;
}

function openEdit(n: Note) {
  editId.value = n.id;
  activeType.value = n.type;
  form.value = { title: n.title, content: n.content };
  dialogVisible.value = true;
}

async function save() {
  if (!form.value.content.trim()) {
    MessagePlugin.warning("内容不能为空");
    return;
  }
  try {
    if (editId.value) {
      await store.update(editId.value, { title: form.value.title.trim(), content: form.value.content.trim() });
    } else {
      await store.create(workId, { type: activeType.value, title: form.value.title.trim(), content: form.value.content.trim() });
    }
    MessagePlugin.success(editId.value ? "已保存" : "已记下");
    dialogVisible.value = false;
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}

function confirmRemove(n: Note) {
  const dlg = DialogPlugin.confirm({
    header: `删除这条${NOTE_TYPES[n.type]}`,
    body: n.title || "（无题）——删了就真没了，坟场栏也救不回来。",
    theme: "warning",
    confirmBtn: { content: "确认删除", variant: "base" },
    onConfirm: async () => {
      try {
        await store.remove(n.id);
        MessagePlugin.success("已删除");
      } catch (e) {
        MessagePlugin.error((e as Error).message);
      } finally {
        dlg.destroy();
      }
    },
  });
}

/** 类型 → 印章配色：随笔豆绿 / 灵感灯橙 / 坟场灰 */
const typeStamp: Record<string, string> = { note: "xz-stamp--ongoing", idea: "xz-stamp--finished", graveyard: "xz-stamp--shelved" };

/** 各栏空态的指路话（文案口径：邀请，不道歉） */
const emptyHint = computed(() => {
  if (activeType.value === "graveyard") return "写手最该有「废稿坟场」——删掉心疼的段落先进来躺几年，未必真没用";
  if (activeType.value === "idea") return "灵光一闪马上记，别信脑子能存到明天";
  return "阅读感想、思路梳理、任何想写的，都丢这里";
});
</script>

<template>
  <WorkShell>
    <template #actions>
      <t-button theme="primary" @click="openCreate(activeType)">+ 新{{ NOTE_TYPES[activeType] }}</t-button>
    </template>

    <t-tabs v-model="activeType" class="note-tabs">
      <t-tab-panel v-for="(label, key) in NOTE_TYPES" :key="key" :value="key" :label="`${label} ${store.list.filter((n) => n.type === key).length}`">
        <div v-if="filtered.length === 0" class="note-empty">
          <EmptyState :title="`「${label}」还空着`" :hint="emptyHint">
            <t-button theme="primary" @click="openCreate(key as NoteType)">记第一条</t-button>
          </EmptyState>
        </div>

        <div v-else class="note-list">
          <article v-for="n in filtered" :key="n.id" class="note xz-panel">
            <header class="note__head">
              <h3 class="note__title">{{ n.title || NOTE_TYPES[n.type] }}</h3>
              <span class="xz-stamp" :class="typeStamp[n.type]">{{ NOTE_TYPES[n.type] }}</span>
              <span class="note__ops">
                <t-button variant="text" size="small" @click="openEdit(n)">编辑</t-button>
                <t-button variant="text" theme="danger" size="small" @click="confirmRemove(n)">删除</t-button>
              </span>
            </header>
            <div class="xz-md note__body" v-html="renderMd(n.content)" />
            <footer class="note__meta">{{ new Date(n.updatedAt).toLocaleString() }}</footer>
          </article>
        </div>
      </t-tab-panel>
    </t-tabs>

    <t-dialog v-model:visible="dialogVisible" :header="editId ? '编辑' : `新${NOTE_TYPES[activeType]}`" width="560" :footer="false">
      <t-input v-model="form.title" label="标题（可选）" maxlength="128" placeholder="不填默认按类型名占位" style="margin-bottom: 12px" />
      <t-textarea v-model="form.content" :autosize="{ minRows: 5, maxRows: 14 }" label="内容（支持 Markdown）" maxlength="20000" style="margin-bottom: 12px" />
      <t-button block theme="primary" @click="save">保存</t-button>
    </t-dialog>
  </WorkShell>
</template>

<style scoped>
.note-tabs :deep(.t-tabs__nav) {
  margin-bottom: 16px;
}
.note-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.note {
  padding: 18px 20px 14px;
}
.note__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.note__title {
  margin: 0;
  font-family: "STKaiti", "KaiTi", "Noto Serif SC", serif;
  font-size: var(--xz-text-h3);
  font-weight: 700;
  color: var(--xz-ink);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.note__ops {
  margin-left: auto;
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
.note__body {
  font-size: var(--xz-text-body);
  color: var(--xz-ink-2);
}
.note__body :deep(p:last-child) {
  margin-bottom: 0;
}
.note__meta {
  margin-top: 10px;
  font-size: var(--xz-text-xs);
  color: var(--xz-ink-3);
}
</style>
