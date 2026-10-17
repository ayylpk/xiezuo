<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { MessagePlugin } from "tdesign-vue-next";
import { marked } from "marked";
import DOMPurify from "dompurify";

import { CHAPTER_STATUS, useChaptersStore } from "../stores/chapters";

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
</script>

<template>
  <div class="page">
    <header class="topbar">
      <t-button variant="text" @click="router.push(`/works/${workId}/chapters`)">← 章节列表</t-button>
      <t-select class="status-sel" :value="status" size="small" @change="setStatus">
        <t-option v-for="(label, key) in CHAPTER_STATUS" :key="key" :value="key as keyof typeof CHAPTER_STATUS" :label="label" />
      </t-select>
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
</style>