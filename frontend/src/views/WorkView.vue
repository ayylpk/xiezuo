<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { DialogPlugin, MessagePlugin } from "tdesign-vue-next";

import { api } from "../api/client";
import { WORK_STATUS_TEXT } from "../constants";
import { useWorksStore } from "../stores/works";
import WorkShell from "../components/WorkShell.vue";
import EmptyState from "../components/EmptyState.vue";

const route = useRoute();
const router = useRouter();
const worksStore = useWorksStore();
const workId = Number(route.params.id);

const detail = ref<{
  id: number;
  title: string;
  description: string;
  status: string;
  chapterCount: number;
  totalWords: number;
  chapters: { id: number; title: string; status: string; wordCount: number; sortNo: number }[];
} | null>(null);

const editing = ref(false);
const editTitle = ref("");
const editDesc = ref("");

async function load() {
  try {
    const { work: d } = await api.get<{ work: typeof detail.value }>(`/works/${workId}`);
    detail.value = d;
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}

onMounted(load);

const statusText = computed(() => (detail.value ? WORK_STATUS_TEXT[detail.value.status] : ""));

function startEdit() {
  editing.value = true;
  editTitle.value = detail.value!.title;
  editDesc.value = detail.value!.description;
}

async function saveEdit() {
  try {
    await worksStore.update(workId, { title: editTitle.value, description: editDesc.value });
    MessagePlugin.success("已保存");
    editing.value = false;
    load();
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}

/** 删除整作：DialogPlugin 确认（替代原生 confirm，风格统一） */
function confirmRemove() {
  const dlg = DialogPlugin.confirm({
    header: "删除整个作品",
    body: `《${detail.value?.title}》的 ${detail.value?.chapterCount} 章正文将一并删除，不可恢复。`,
    theme: "warning",
    confirmBtn: { content: "确认删除", variant: "base" },
    onConfirm: async () => {
      try {
        await worksStore.remove(workId);
        MessagePlugin.success("已删除");
        router.push("/");
      } catch (e) {
        MessagePlugin.error((e as Error).message);
      } finally {
        dlg.destroy();
      }
    },
  });
}

/** 导出：后端返回文件流（非 JSON），直接 fetch + Blob 触发下载，不走 api client */
async function download(format: string) {
  try {
    const resp = await fetch(`/api/works/${workId}/export?format=${format}`, { credentials: "same-origin" });
    if (!resp.ok) {
      const body = await resp.json().catch(() => null);
      throw new Error(body?.error ?? "导出失败");
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const cd = resp.headers.get("content-disposition") ?? "";
    const m = cd.match(/filename\*=UTF-8''([^;]+)/);
    a.download = m ? decodeURIComponent(m[1]) : `作品-${workId}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    MessagePlugin.success("已开始下载");
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}

const CH_STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  draft: { text: "草稿", cls: "xz-stamp--shelved" },
  written: { text: "已写", cls: "xz-stamp--ongoing" },
  review: { text: "待审", cls: "xz-stamp--open" },
  final: { text: "定稿", cls: "xz-stamp--closed" },
};
</script>

<template>
  <WorkShell>
    <template #actions>
      <t-button variant="outline" @click="router.push('/search')">搜索</t-button>
      <t-dropdown @click="(opt: { value: string }) => download(opt.value)">
        <t-button variant="outline">导出</t-button>
        <template #dropdown>
          <t-dropdown-menu>
            <t-dropdown-item value="md">Markdown</t-dropdown-item>
            <t-dropdown-item value="txt">纯文本</t-dropdown-item>
            <t-dropdown-item value="json">JSON（全量数据）</t-dropdown-item>
          </t-dropdown-menu>
        </template>
      </t-dropdown>
      <t-button theme="danger" variant="outline" @click="confirmRemove">删除作品</t-button>
      <t-button theme="primary" @click="router.push(`/works/${workId}/chapters`)">写章节</t-button>
    </template>

    <div v-if="detail" class="grid">
      <!-- 左：作品档案 -->
      <section class="xz-panel profile">
        <h1 class="profile__title">{{ detail.title }}</h1>
        <div class="profile__stats">
          <span class="profile__stat"><b>{{ detail.chapterCount }}</b> 章</span>
          <span class="profile__stat"><b>{{ detail.totalWords.toLocaleString() }}</b> 字</span>
          <span class="xz-stamp">{{ statusText }}</span>
        </div>
        <p class="profile__desc">{{ detail.description || "还没写简介。简介是给未来的自己留的书签。" }}</p>
        <t-button variant="outline" block @click="startEdit">编辑信息</t-button>
      </section>

      <!-- 右：章节一览 -->
      <section class="xz-panel chapters">
        <h2 class="chapters__head">章节一览</h2>
        <EmptyState
          v-if="detail.chapters.length === 0"
          title="还没有章节"
          hint="第一章从右上角「写章节」开始"
        >
          <t-button theme="primary" @click="router.push(`/works/${workId}/chapters`)">去开笔</t-button>
        </EmptyState>
        <div v-else class="xz-rows">
          <div
            v-for="ch in detail.chapters"
            :key="ch.id"
            class="xz-row chapters__row"
            tabindex="0"
            @click="router.push(`/works/${workId}/chapters/${ch.id}`)"
            @keydown.enter="router.push(`/works/${workId}/chapters/${ch.id}`)"
          >
            <span class="xz-no">{{ ch.sortNo }}</span>
            <span class="chapters__title">{{ ch.title }}</span>
            <span v-if="CH_STATUS_LABEL[ch.status]" class="xz-stamp" :class="CH_STATUS_LABEL[ch.status].cls">
              {{ CH_STATUS_LABEL[ch.status].text }}
            </span>
            <span class="chapters__words">{{ ch.wordCount.toLocaleString() }} 字</span>
          </div>
        </div>
      </section>
    </div>

    <t-dialog v-model:visible="editing" header="编辑作品信息" width="480" :footer="false">
      <t-input v-model="editTitle" label="书名" maxlength="128" style="margin-bottom: 16px" />
      <t-textarea v-model="editDesc" label="简介" :autosize="{ minRows: 3 }" maxlength="2000" />
      <t-button block theme="primary" style="margin-top: 16px" @click="saveEdit">保存</t-button>
    </t-dialog>
  </WorkShell>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 22px;
  align-items: start;
}

/* 作品档案卡 */
.profile {
  padding: 22px 22px 20px;
}
.profile__title {
  margin: 0 0 12px;
  font-family: "STKaiti", "KaiTi", "Noto Serif SC", serif;
  font-size: 22px;
  line-height: 1.4;
  color: var(--xz-ink);
}
.profile__stats {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 12px;
}
.profile__stat {
  color: var(--xz-ink-2);
  font-size: var(--xz-text-xs);
}
.profile__stat b {
  color: var(--xz-ink);
  font-size: var(--xz-text-h3);
  font-variant-numeric: tabular-nums;
  margin-right: 2px;
}
.profile__desc {
  color: var(--xz-ink-2);
  font-size: var(--xz-text-sm);
  line-height: 1.75;
  margin: 0 0 18px;
  white-space: pre-wrap;
}

/* 章节一览 */
.chapters {
  overflow: hidden; /* 行 hover 背景不溢出圆角 */
}
.chapters__head {
  margin: 0;
  padding: 16px 20px 12px;
  font-size: var(--xz-text-h3);
  font-weight: 600;
  border-bottom: 1px solid var(--xz-line);
}
.chapters__row {
  cursor: pointer;
  outline: none;
}
.chapters__row:focus-visible {
  background: var(--xz-panel-2);
}
.chapters__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chapters__words {
  flex-shrink: 0;
  color: var(--xz-ink-3);
  font-size: var(--xz-text-xs);
  font-variant-numeric: tabular-nums;
}

/* 窄屏：单列 */
@media (max-width: 820px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
