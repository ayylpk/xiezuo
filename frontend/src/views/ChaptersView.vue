<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { DialogPlugin, MessagePlugin } from "tdesign-vue-next";

import { CHAPTER_STATUS, useChaptersStore, type ChapterMeta } from "../stores/chapters";
import WorkShell from "../components/WorkShell.vue";
import EmptyState from "../components/EmptyState.vue";

const route = useRoute();
const router = useRouter();
const store = useChaptersStore();
const workId = Number(route.params.id);

const creating = ref(false);

onMounted(() => store.fetchList(workId).catch((e) => MessagePlugin.error(e.message)));

async function onAdd() {
  creating.value = true;
  try {
    const { chapter } = await store.create(workId);
    router.push(`/works/${workId}/chapters/${chapter.id}`);
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  } finally {
    creating.value = false;
  }
}

async function onStatusChange(chapterId: number, status: string) {
  try {
    await store.setStatus(chapterId, status as keyof typeof CHAPTER_STATUS);
    MessagePlugin.success("状态已更新");
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}

/** 删除：DialogPlugin 确认（原生 confirm 与全站风格冲突） */
function confirmDelete(ch: ChapterMeta) {
  const dlg = DialogPlugin.confirm({
    header: "删除章节",
    body: `《${ch.title}》${ch.wordCount ? `${ch.wordCount} 字` : ""}正文不可恢复。`,
    theme: "warning",
    confirmBtn: { content: "确认删除", variant: "base" },
    onConfirm: async () => {
      try {
        await store.remove(ch.id);
        MessagePlugin.success("已删除");
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
  <WorkShell>
    <template #actions>
      <t-button theme="primary" :loading="creating" @click="onAdd">+ 新章节</t-button>
    </template>

    <section class="xz-panel">
      <EmptyState
        v-if="store.list.length === 0"
        title="一章都还没有"
        hint="第一章从右上角「新章节」开始——先写 500 字，比想 5000 字的大纲有用"
      >
        <t-button theme="primary" :loading="creating" @click="onAdd">开笔第一章</t-button>
      </EmptyState>

      <div v-else class="xz-rows">
        <div v-for="ch in store.list" :key="ch.id" class="xz-row chapter">
          <span class="xz-no">{{ ch.sortNo }}</span>
          <div class="chapter__main" tabindex="0" @click="router.push(`/works/${workId}/chapters/${ch.id}`)" @keydown.enter="router.push(`/works/${workId}/chapters/${ch.id}`)">
            <span class="chapter__title">{{ ch.title }}</span>
            <span v-if="ch.synopsis" class="chapter__synopsis">{{ ch.synopsis }}</span>
          </div>
          <span class="chapter__words">{{ ch.wordCount.toLocaleString() }} 字</span>
          <t-select class="chapter__status" :value="ch.status" size="small" @change="(v: string) => onStatusChange(ch.id, v)">
            <t-option v-for="(label, key) in CHAPTER_STATUS" :key="key" :value="key" :label="label" />
          </t-select>
          <t-button variant="text" theme="danger" size="small" @click="confirmDelete(ch)">删除</t-button>
        </div>
      </div>
    </section>
  </WorkShell>
</template>

<style scoped>
.chapter__main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 12px;
  cursor: pointer;
  outline: none;
}
.chapter__main:focus-visible .chapter__title {
  color: var(--xz-lamp);
}
.chapter__title {
  font-family: "STKaiti", "KaiTi", "Noto Serif SC", serif;
  font-size: var(--xz-text-h3);
  color: var(--xz-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chapter__main:hover .chapter__title {
  color: var(--xz-green);
}
.chapter__synopsis {
  flex-shrink: 1;
  min-width: 0;
  color: var(--xz-ink-3);
  font-size: var(--xz-text-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chapter__words {
  flex-shrink: 0;
  color: var(--xz-ink-3);
  font-size: var(--xz-text-xs);
  font-variant-numeric: tabular-nums;
}
.chapter__status {
  width: 96px;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .chapter__synopsis {
    display: none;
  }
}
</style>
