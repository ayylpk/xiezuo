<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { DialogPlugin, MessagePlugin } from "tdesign-vue-next";

import { CHAPTER_STATUS, useChaptersStore } from "../stores/chapters";
import { useAnnotationsStore, type Annotation } from "../stores/annotations";
import DeskHeader from "../components/DeskHeader.vue";

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

function annConfirmRemove(a: Annotation) {
  const dlg = DialogPlugin.confirm({
    header: "删掉这条批注",
    body: a.content.length > 40 ? a.content.slice(0, 40) + "…" : a.content,
    theme: "warning",
    confirmBtn: { content: "删除", variant: "base" },
    onConfirm: async () => {
      try {
        await annotations.remove(a.id);
      } catch (e) {
        MessagePlugin.error((e as Error).message);
      } finally {
        dlg.destroy();
      }
    },
  });
}
</script>

<template>
  <div class="page">
    <DeskHeader :back-to="`/works/${workId}/chapters`" back-label="章节">
      <template #center>
        <t-select class="status-sel" :value="status" size="small" @change="setStatus">
          <t-option v-for="(label, key) in CHAPTER_STATUS" :key="key" :value="key as keyof typeof CHAPTER_STATUS" :label="label" />
        </t-select>
        <t-button variant="outline" size="small" @click="annVisible = true">
          批注{{ annotations.list.length ? ` ${annotations.list.length}` : "" }}
        </t-button>
      </template>
      <template #actions>
        <span class="meta" v-if="lastSavedAt">
          {{ dirty ? "未保存…" : `已存 ${new Date(lastSavedAt).toLocaleTimeString()}` }}
        </span>
        <span class="meta meta--strong">{{ words.toLocaleString() }} 字</span>
        <t-button theme="primary" :loading="saving" @click="save()">保存</t-button>
      </template>
    </DeskHeader>

    <main class="editor" v-if="loaded">
      <!-- 卷首：题名与章意 -->
      <div class="editor__head">
        <input v-model="title" class="title-input" placeholder="章节标题" maxlength="128" />
        <input v-model="synopsis" class="synopsis-input" placeholder="一句话剧情（本章摘要，可选）" maxlength="500" />
      </div>

      <div class="manuscript">
        <!-- 单栏写作区：居中 70%，左右各留 15% 空白。
             textarea 原样保存换行符（\n），导出 md/txt 与这里打的完全一致。 -->
        <textarea
          v-model="content"
          class="write-area"
          placeholder="开始写作…（支持 Markdown，停笔 2 秒自动落盘）"
          spellcheck="false"
        />
      </div>
    </main>

    <!-- 批注抽屉：不打断写作流 -->
    <t-drawer v-model:visible="annVisible" header="本章批注" size="360px" :footer="false">
      <div class="ann-list">
        <div v-if="annotations.list.length === 0" class="ann-empty">
          还没有批注——"这里要呼应 XX 章""这句要改"随手记下，比贴书签靠谱
        </div>
        <div v-for="a in annotations.list" :key="a.id" class="ann-item xz-panel">
          <div class="ann-content">{{ a.content }}</div>
          <div class="ann-foot">
            <span>{{ new Date(a.updatedAt).toLocaleString() }}</span>
            <t-space size="4">
              <t-button variant="text" size="small" @click="annStartEdit(a)">修改</t-button>
              <t-button variant="text" theme="danger" size="small" @click="annConfirmRemove(a)">删除</t-button>
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
  background: var(--xz-wall);
}
.status-sel {
  width: 104px;
}
.meta {
  color: var(--xz-ink-3);
  font-size: var(--xz-text-xs);
}
.meta--strong {
  color: var(--xz-ink);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  /* 左右空白不在这里给，交给下面 70% 居中；这样比例随屏幕走 */
  padding: 20px 0 24px;
}

/* 卷首 + 稿纸：同宽 70%，左右各留 15% 屏幕空白 */
.editor__head {
  width: 70%;
  margin: 0 auto 16px;
}
.title-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-family: "STKaiti", "KaiTi", "Noto Serif SC", serif;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: 0.04em;
  color: var(--xz-ink);
  margin-bottom: 6px;
}
.title-input::placeholder {
  color: var(--xz-ink-3);
}
.synopsis-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: var(--xz-text-sm);
  color: var(--xz-ink-2);
  border-bottom: 1px dashed var(--xz-line-2);
  padding-bottom: 6px;
}
.synopsis-input::placeholder {
  color: var(--xz-ink-3);
}

/* ---------- 稿纸：单栏居中 ---------- */
.manuscript {
  flex: 1;
  width: 70%;
  margin: 0 auto;
  min-height: 0;
  overflow: auto;
  background-color: var(--xz-paper);
  /* 横线已按要求去掉：不再用 repeating-linear-gradient 画行线，
     文字靠 line-height 保持行距，正文本身不带任何视觉干扰。 */
  border-radius: 8px;
  box-shadow: var(--td-shadow-2);
  padding: 24px 0 40px;
}
.write-area {
  display: block;
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  font-family: "STKaiti", "KaiTi", "Noto Serif SC", serif;
  font-size: 17px;
  line-height: 36px;
  color: var(--xz-paper-ink);
  /* 内边距按纸宽的百分比给，纸变宽时文字不会贴边 */
  padding: 0 48px;
}
.write-area::placeholder {
  color: var(--xz-paper-ink-3);
}

/* ---------- 批注抽屉 ---------- */
.ann-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  overflow: auto;
}
.ann-item {
  padding: 10px 12px;
}
.ann-content {
  font-size: var(--xz-text-body);
  line-height: 1.65;
  word-break: break-word;
  white-space: pre-wrap;
}
.ann-foot {
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--xz-text-xs);
  color: var(--xz-ink-3);
}
.ann-input {
  border-top: 1px solid var(--xz-line);
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
  color: var(--xz-ink-3);
  font-size: var(--xz-text-sm);
  line-height: 1.7;
}

/* 窄屏（手机/竖屏）：70% 没法写，铺满，纸的圆角和阴影也一并去掉 */
@media (max-width: 768px) {
  .editor {
    padding: 16px 0 20px;
  }
  .editor__head,
  .manuscript {
    width: 100%;
  }
  .manuscript {
    border-radius: 0;
    box-shadow: none;
  }
  .write-area {
    padding: 0 20px;
  }
}
</style>
