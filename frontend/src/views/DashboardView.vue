<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { MessagePlugin } from "tdesign-vue-next";
import dayjs from "dayjs";

import { useWorksStore, type Work } from "../stores/works";
import { useAuthStore } from "../stores/auth";
import { WORK_STATUS_TEXT } from "../constants";
import ThemeToggle from "../components/ThemeToggle.vue";

const worksStore = useWorksStore();
const auth = useAuthStore();
const router = useRouter();

const dialogVisible = ref(false);
const newTitle = ref("");
const creating = ref(false);

onMounted(() => worksStore.fetchAll().catch((e) => MessagePlugin.error(e.message)));

/* 书脊色族：低饱和墨彩，夜底可见；同书恒同色 */
const SPINES = ["#6f7f5e", "#a8794f", "#8a6f63", "#71809a", "#9a9668", "#b08968"];
function spineOf(id: number) {
  return SPINES[id % SPINES.length];
}
/* 书脊竖排只放得下前几个字 */
function spineTitle(t: string) {
  return t.length > 12 ? t.slice(0, 12) : t;
}

const totals = computed(() =>
  worksStore.works.reduce(
    (acc, w) => {
      acc.chapters += w.chapterCount ?? 0;
      acc.words += w.totalWords ?? 0;
      return acc;
    },
    { chapters: 0, words: 0 }
  )
);

async function onCreate() {
  if (!newTitle.value.trim()) {
    MessagePlugin.warning("书名不能为空");
    return;
  }
  creating.value = true;
  try {
    const { work } = await worksStore.create(newTitle.value.trim());
    MessagePlugin.success("作品已创建");
    router.push(`/works/${work.id}`);
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  } finally {
    creating.value = false;
    dialogVisible.value = false;
    newTitle.value = "";
  }
}

function stampClass(status: Work["status"]) {
  return { ongoing: "stamp--ongoing", finished: "stamp--finished", shelved: "stamp--shelved" }[status];
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <span class="brand xz-display">写作台</span>
      <div class="topbar__right">
        <ThemeToggle />
        <t-button variant="outline" @click="router.push('/search')">搜索</t-button>
        <t-button theme="primary" @click="dialogVisible = true">+ 新作品</t-button>
        <t-button variant="text" @click="auth.logout(); router.push('/login')">退出</t-button>
      </div>
    </header>

    <main class="shelf">
      <div class="shelf-head">
        <h2 class="shelf-title xz-display">灯下书架</h2>
        <span v-if="worksStore.works.length" class="shelf-count">
          共 {{ worksStore.works.length }} 部 · {{ totals.chapters }} 章 · {{ totals.words.toLocaleString() }} 字
        </span>
      </div>

      <div v-if="worksStore.works.length === 0 && worksStore.loaded" class="empty">
        <!-- 空书架：一盏孤灯 -->
        <div class="empty__lamp" aria-hidden="true">
          <div class="empty__beam"></div>
          <div class="empty__shade"><div class="empty__bulb"></div></div>
          <div class="empty__stem"></div>
        </div>
        <p class="empty__title xz-display">书架还空着</p>
        <p class="empty__hint">新书的第一行字，还等着你落笔</p>
        <t-button theme="primary" variant="outline" @click="dialogVisible = true">新建第一本书</t-button>
      </div>

      <div v-else class="cards">
        <article
          v-for="w in worksStore.works"
          :key="w.id"
          class="book"
          :style="{ '--spine': spineOf(w.id) }"
          tabindex="0"
          @click="router.push(`/works/${w.id}`)"
          @keydown.enter="router.push(`/works/${w.id}`)"
        >
          <!-- 书脊：竖排书名 -->
          <div class="book__spine">
            <span class="book__spine-title">{{ spineTitle(w.title) }}</span>
          </div>
          <!-- 封面：稿纸 -->
          <div class="book__cover">
            <div class="book__head">
              <h3 class="book__title">{{ w.title }}</h3>
              <span class="stamp" :class="stampClass(w.status)">{{ WORK_STATUS_TEXT[w.status] }}</span>
            </div>
            <p class="book__desc">{{ w.description || "还没写简介——但故事已经开始了" }}</p>
            <div class="book__meta">
              <span>{{ w.chapterCount ?? 0 }} 章</span>
              <span class="book__meta-sep"></span>
              <span>{{ (w.totalWords ?? 0).toLocaleString() }} 字</span>
              <span v-if="w.updatedAt" class="book__meta-date">更至 {{ dayjs(w.updatedAt).format("MM-DD") }}</span>
            </div>
          </div>
          <!-- 右侧页口：一沓纸的切面 -->
          <div class="book__pages" aria-hidden="true"></div>
        </article>
      </div>
    </main>

    <t-dialog v-model:visible="dialogVisible" header="新建作品" width="420" :footer="false" @closed="newTitle = ''">
      <t-input v-model="newTitle" placeholder="作品名" maxlength="128" @enter="onCreate" />
      <t-button block theme="primary" style="margin-top: 16px" :loading="creating" @click="onCreate">创建</t-button>
    </t-dialog>
  </div>
</template>

<style scoped>
.page {
  min-height: 100%;
}

/* ---------- 顶栏 ---------- */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 32px;
  background: var(--xz-panel);
  border-bottom: 1px solid var(--xz-line);
  position: sticky;
  top: 0;
  z-index: 10;
}
.brand {
  font-size: 21px;
  font-weight: 700;
}
.topbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ---------- 书架 ---------- */
.shelf {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 32px 56px;
}
.shelf-head {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 22px;
}
.shelf-title {
  margin: 0;
  font-size: var(--xz-text-title);
  font-weight: 700;
}
.shelf-count {
  color: var(--xz-ink-3);
  font-size: var(--xz-text-xs);
  letter-spacing: 0.06em;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(268px, 1fr));
  gap: 22px;
}

/* ---------- 书卷卡：书脊 + 稿纸封面 + 页口 ---------- */
.book {
  --spine: var(--xz-green);
  position: relative;
  display: flex;
  min-height: 208px;
  background: var(--xz-paper);
  border-radius: 3px 6px 6px 3px; /* 书形：书脊侧小圆，开口侧大圆 */
  box-shadow: var(--td-shadow-2);
  cursor: pointer;
  overflow: hidden;
  outline: none;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.book:hover {
  transform: translateY(-4px);
  box-shadow: var(--td-shadow-3), 0 12px 34px var(--xz-lamp-wash);
}
.book:active {
  transform: translateY(-4px) scale(0.985);
}

/* 书脊：受光渐变，竖排书名 */
.book__spine {
  flex-shrink: 0;
  width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--spine) 62%, #14181f) 0%,
    var(--spine) 70%,
    color-mix(in srgb, var(--spine) 88%, #fff 12%) 100%
  );
  box-shadow: inset -1px 0 0 rgba(20, 18, 12, 0.35);
}
.book__spine-title {
  writing-mode: vertical-rl;
  font-family: "STKaiti", "KaiTi", serif;
  font-size: 12px;
  letter-spacing: 0.18em;
  color: rgba(245, 240, 228, 0.92);
  max-height: calc(100% - 24px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 封面 */
.book__cover {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px 14px;
  /* 稿纸极淡横纹（书写感，不抢字） */
  background-image: repeating-linear-gradient(180deg, transparent 0 29px, var(--xz-paper-line) 29px 30px);
  background-position: 0 52px;
  opacity: 1;
}
.book__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}
.book__title {
  margin: 0;
  font-family: "STKaiti", "KaiTi", "Noto Serif SC", serif;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1.35;
  color: var(--xz-paper-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.book__desc {
  margin: 0;
  flex: 1;
  color: var(--xz-paper-ink-2);
  font-size: var(--xz-text-sm);
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.book__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--xz-text-xs);
  color: var(--xz-paper-ink-3);
  font-variant-numeric: tabular-nums;
}
.book__meta-sep::before {
  content: "·";
}
.book__meta-date {
  margin-left: auto;
}

/* 状态印章：边框略歪，盖上去 */
.stamp {
  flex-shrink: 0;
  padding: 2px 8px;
  border: 1.5px solid currentColor;
  border-radius: 2px;
  font-size: 11px;
  font-family: "STKaiti", "KaiTi", serif;
  letter-spacing: 0.22em;
  transform: rotate(-5deg);
  opacity: 0.82;
  margin-top: 2px;
}
.stamp--ongoing {
  color: #5d7049;
}
.stamp--finished {
  color: #b87c33;
}
.stamp--shelved {
  color: #8b8371;
}

/* 页口：右侧一沓纸的切面 */
.book__pages {
  position: absolute;
  right: 0;
  top: 10px;
  bottom: 10px;
  width: 6px;
  background: repeating-linear-gradient(
    90deg,
    var(--xz-paper-2) 0 1px,
    transparent 1px 2px
  );
  border-radius: 0 3px 3px 0;
  box-shadow: inset 1px 0 0 rgba(20, 18, 12, 0.1);
  pointer-events: none;
}

/* ---------- 空书架：一盏孤灯 ---------- */
.empty {
  padding: 36px 0 88px;
  text-align: center;
}
.empty__lamp {
  position: relative;
  width: 120px;
  height: 118px;
  margin: 8px auto 26px;
}
.empty__beam {
  position: absolute;
  top: 58px;
  left: 50%;
  transform: translateX(-50%);
  width: 240px;
  height: 220px;
  clip-path: polygon(40% 0, 60% 0, 92% 100%, 8% 100%);
  background: linear-gradient(180deg, var(--xz-lamp-glow), transparent 80%);
  filter: blur(8px);
}
.empty__shade {
  position: absolute;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  width: 86px;
  height: 38px;
  clip-path: polygon(22% 0, 78% 0, 100% 100%, 0 100%);
  background: linear-gradient(180deg, var(--xz-panel-2), var(--xz-panel-3));
}
.empty__bulb {
  position: absolute;
  left: 50%;
  bottom: -1px;
  transform: translateX(-50%);
  width: 62px;
  height: 11px;
  border-radius: 50%;
  background: radial-gradient(50% 100% at 50% 0%, var(--xz-lamp-hi), var(--xz-lamp) 65%, transparent);
  filter: blur(1.5px);
}
.empty__stem {
  position: absolute;
  top: 50px;
  left: calc(50% + 40px);
  width: 3px;
  height: 52px;
  background: var(--xz-line-2);
  transform: rotate(16deg);
  transform-origin: top;
}
.empty__title {
  margin: 0;
  font-size: var(--xz-text-title);
  font-weight: 700;
}
.empty__hint {
  margin: 8px 0 24px;
  color: var(--xz-ink-2);
  font-size: var(--xz-text-sm);
  letter-spacing: 0.1em;
}

/* ---------- 窄屏 ---------- */
@media (max-width: 640px) {
  .topbar {
    padding: 10px 16px;
    flex-wrap: wrap;
  }
  .shelf {
    padding: 20px 16px 44px;
  }
  .cards {
    grid-template-columns: 1fr;
  }
}
</style>