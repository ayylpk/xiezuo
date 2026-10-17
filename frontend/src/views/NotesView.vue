<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { MessagePlugin } from "tdesign-vue-next";
import { marked } from "marked";
import DOMPurify from "dompurify";

import { NOTE_TYPES, useNotesStore, type Note, type NoteType } from "../stores/notes";

const route = useRoute();
const router = useRouter();
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

async function removeNote(n: Note) {
  if (!window.confirm(`删除这条${NOTE_TYPES[n.type]}？`)) return;
  try {
    await store.remove(n.id);
    MessagePlugin.success("已删除");
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}

const typeTheme: Record<string, string> = { note: "primary", idea: "warning", graveyard: "default" };
</script>

<template>
  <div class="page">
    <header class="topbar">
      <t-button variant="text" @click="router.push(`/works/${workId}`)">← 作品</t-button>
      <span class="title">随笔</span>
      <t-tabs v-model="activeType" class="tabs">
        <t-tab-panel v-for="(label, key) in NOTE_TYPES" :key="key" :value="key" :label="`${label} ${store.list.filter((n) => n.type === key).length}`" />
      </t-tabs>
      <t-button theme="primary" @click="openCreate('note')">+ 新随笔</t-button>
    </header>

    <main class="body">
      <div v-if="filtered.length === 0" class="empty">这一栏还空着。
        <span v-if="activeType === 'graveyard'">写手最该有"废稿坟场"——删掉心疼的段落先进来躺几年，未必真没用。</span>
        <span v-else-if="activeType === 'idea'">灵光一闪马上记，别信脑子能存到明天。</span>
        <span v-else>阅读感想、思路梳理、任何想写的，都丢这里。</span>
      </div>
      <t-card v-for="n in filtered" :key="n.id" class="note-card" :bordered="false" :title="n.title || NOTE_TYPES[n.type]">
        <template #actions>
          <t-tag :theme="typeTheme[n.type]" variant="light" size="small">{{ NOTE_TYPES[n.type] }}</t-tag>
          <t-button variant="text" size="small" @click="openEdit(n)">编</t-button>
          <t-button variant="text" theme="danger" size="small" @click="removeNote(n)">删</t-button>
        </template>
        <div class="note-body" v-html="renderMd(n.content)" />
        <div class="meta">{{ new Date(n.updatedAt).toLocaleString() }}</div>
      </t-card>
    </main>

    <t-dialog v-model:visible="dialogVisible" :header="editId ? '编辑' : `新${NOTE_TYPES[activeType]}`" width="560" :footer="false">
      <t-input v-model="form.title" label="标题（可选）" maxlength="128" placeholder="不填默认按类型名占位" style="margin-bottom: 12px" />
      <t-textarea v-model="form.content" :autosize="{ minRows: 5, maxRows: 14 }" label="内容（支持 Markdown）" maxlength="20000" style="margin-bottom: 12px" />
      <t-button block theme="primary" @click="save">保存</t-button>
    </t-dialog>
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
.tabs {
  flex: 1;
}
.body {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.note-card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.note-body {
  line-height: 1.7;
  color: var(--td-text-color-primary);
}
.note-body :deep(p) {
  margin: 0 0 8px;
}
.meta {
  margin-top: 12px;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}
.empty {
  padding: 60px 0;
  text-align: center;
  color: var(--td-text-color-placeholder);
}
</style>