<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { MessagePlugin } from "tdesign-vue-next";
import { marked } from "marked";
import DOMPurify from "dompurify";

import { CHAPTER_STATUS, useChaptersStore } from "../stores/chapters";
import { useAnnotationsStore, type Annotation } from "../stores/annotations";

const route = useRoute();
const router = useRouter();
const store = useChaptersStore();
const workId = Number(route.params.id);
const chapterId = Number(route.params.cid);

const loaded = ref(false);
const title = ref("");
const synopsis = ref("");
const content = ref("");
const status = ref<keyof typeof CHAPTER_STATUS>("draft");
const saving = ref(false);
const lastSavedAt = ref<number | null>(null);
const dirty = ref(false);

// ---------- 批注：挂在当前章节上（"这里要呼应 XX 章"随手记） ----------
const annotations = useAnnotationsStore();
const annVisible = ref(false);
const annText = ref("");
const annEditId = ref<number | null>(null);
const annSaving = ref(false);

const words = computed(() => content.value.replace(/\s/g, "").length);
const previewHtml = computed(() => DOMPurify.sanitize(marked.parse(content.value) as string));

// ---------- 加载 ----------
onMounted(async () => {
  try {
    const { chapter } = await store.get(chapterId);
    title.value = chapter.title;
    synopsis.value = chapter.synopsis;
    content.value = chapter.content;
    status.value = chapter.status;
    lastSavedAt.value = chapter.updatedAt;
  } catch (e) {
    MessagePlugin.error((e as Error).message);
    router.push(`/works/${workId}/chapters`);
  } finally {
    loaded.value = true;
  }
  annotations.fetchByTarget("chapter", chapterId).catch(() => {});
});

// ---------- 保存：手动 + 自动（停笔 2s 触发）双保险 ----------
let autoTimer: ReturnType<typeof setTimeout> | undefined;

async function save(notify = true) {
  if (!loaded.value || saving.value) return;
  saving.value = true;
  try {
    const { chapter } = await store.update(chapterId, { title: title.value, synopsis: synopsis.value, content: content.value });
    lastSavedAt.value = chapter.updatedAt;
    dirty.value = false;
    if (notify) MessagePlugin.success(`已保存 · ${chapter.wordCount} 字`);
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  } finally {
    saving.value = false;
  }
}

watch([title, synopsis, content], () => {
  if (!loaded.value) return;
  dirty.value = true;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => save(false), 2000); // 停笔 2 秒自动落盘
});

async function setStatus(next: keyof typeof CHAPTER_STATUS) {
  status.value = next;
  try {
    const { chapter } = await store.setStatus(chapterId, next);
    status.value = chapter.status;
    MessagePlugin.success(`状态 → ${CHAPTER_STATUS[chapter.status]}`);
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}

onBeforeUnmount(() => {
  clearTimeout(autoTimer);
  if (dirty.value && loaded.value) save(false); // 离开前兜底落盘（fire-and-forget）
});

// ---------- 批注操作 ----------
function annStartEdit(a: Annotation) {
  annEditId.value = a.id;
  annText.value = a.content;
}

function annCancelEdit() {
  annEditId.value = null;
  annText.value = "";
}

async function annSave() {
  const text = annText.value.trim();
  if (!text) {
    MessagePlugin.warning("写点什么再存");
    return;
  }
  annSaving.value = true;
  try {
    if (annEditId.value) await annotations.update(annEditId.value, text);
    else await annotations.create("chapter", chapterId, text);
    annText.value = "";
    annEditId.value = null;
    MessagePlugin.success("批注已存");
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  } finally {
    annSaving.value = false;
  }
}

async function annRemove(a: Annotation) {
  if (!window.confirm("删掉这条批注？")) return;
  try {
    await annotations.remove(a.id);
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <t-button variant="text" @click="router.push(`/works/${workId}/chapters`)">← 章节列表</t-button>
      <t-select class="status-sel" :value="status" size="small" @change="setStatus">
        <t-option v-for="(label, key) in CHAPTER_STATUS" :key="key" :value="key as keyof typeof CHAPTER_STATUS" :label="label" />
      </t-select>
      <t-button variant="outline" @click="annVisible = true">
        批注{{ annotations.list.length ? `(${annotations.list.length})` : "" }}
      </t-button>
      <t-space>
        <span class="meta" v-if="lastSavedAt">上次保存 {{ new Date(lastSavedAt).toLocaleTimeString() }} · {{ dirty ? "未保存" : "已保存" }}</span>
        <span class="meta strong">{{ words.toLocaleString() }} 字</span>
        <t-button theme="primary" :loading="saving" @click="save()">保存</t-button>
      </t-space>
    </header>

    <main class="editor" v-if="loaded">
      <input v-model="title" class="title-input" placeholder="章节标题" maxlength="128" />
      <t-textarea v-model="synopsis" class="synopsis" :autosize="{ minRows: 1, maxRows: 3 }" placeholder="本章简要剧情（一句话）" />

      <div class="split">
        <!-- 左：写作区（markdown 原文） -->
        <div class="pane">
          <textarea v-model="content" class="write-area" placeholder="开始写作…（支持 Markdown）" spellcheck="false" />
        </div>
        <!-- 右：实时预览（marked + DOMPurify 防 XSS） -->
        <div class="pane preview" v-html="previewHtml" :class="{ empty: !content }" />
      </div>
    </main>

    <!-- 批注抽屉：只影响写作流，不弹阻塞对话框 -->
    <t-drawer v-model:visible="annVisible" header="本章批注" size="360px" :footer="false">
      <div class="ann-list">
        <div v-if="annotations.list.length === 0" class="ann-empty">
          还没有批注——"这里要呼应 XX 章""这句要改"随手记下，比贴书签靠谱
        </div>
        <div v-for="a in annotations.list" :key="a.id" class="ann-item">
          <div class="ann-content">{{ a.content }}</div>
          <div class="ann-foot">
            <span>{{ new Date(a.updatedAt).toLocaleString() }}</span>
            <t-space size="4">
              <t-button variant="text" size="small" @click="annStartEdit(a)">改</t-button>
              <t-button variant="text" theme="danger" size="small" @click="annRemove(a)">删</t-button>
            </t-space>
          </div>
        </div>
      </div>
      <div class="ann-input">
        <t-textarea v-model="annText" :autosize="{ minRows: 2 }" placeholder="呼应 / 待改 / 灵感…" maxlength="4000" />
        <t-space class="ann-actions">
          <t-button v-if="annEditId !== null" variant="text" @click="annCancelEdit">取消</t-button>
          <t-button theme="primary" :loading="annSaving" @click="annSave">{{ annEditId !== null ? "保存修改" : "添加批注" }}</t-button>
        </t-space>
      </div>
    </t-drawer>
  </div>
</template>

<style scoped>
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #fff;
}
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 32px;
  border-bottom: 1px solid var(--td-component-stroke);
}
.status-sel {
  width: 120px;
}
.meta {
  color: var(--td-text-color-placeholder);
  font-size: 13px;
}
.meta.strong {
  color: var(--td-text-color-primary);
  font-weight: 600;
}
.editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 16px 32px 0;
}
.title-input {
  border: none;
  outline: none;
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
  background: transparent;
}
.synopsis {
  margin-bottom: 12px;
}
.split {
  flex: 1;
  display: flex;
  min-height: 0;
  gap: 16px;
  padding-bottom: 16px;
}
.pane {
  flex: 1;
  border: 1px solid var(--td-component-stroke);
  border-radius: 8px;
  overflow: auto;
  padding: 16px 20px;
}
.write-area {
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  resize: none;
  font-size: 15px;
  line-height: 1.9;
}
.preview.empty::before {
  content: "输入正文后这里实时预览";
  color: var(--td-text-color-placeholder);
}
.ann-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  overflow: auto;
}
.ann-item {
  border: 1px solid var(--td-component-stroke);
  border-radius: 6px;
  padding: 8px 10px;
}
.ann-content {
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}
.ann-foot {
  margin-top: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}
.ann-input {
  border-top: 1px solid var(--td-component-stroke);
  padding-top: 12px;
}
.ann-actions {
  margin-top: 8px;
  width: 100%;
  justify-content: flex-end;
}
.ann-empty {
  padding: 32px 0;
  text-align: center;
  color: var(--td-text-color-placeholder);
  font-size: 13px;
  line-height: 1.7;
}
</style>