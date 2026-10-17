<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { MessagePlugin } from "tdesign-vue-next";

import { useAuthStore } from "../stores/auth";
import ThemeToggle from "../components/ThemeToggle.vue";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const username = ref("");
const password = ref("");
const loading = ref(false);

async function onSubmit() {
  if (!username.value || !password.value) {
    MessagePlugin.warning("请输入用户名和密码");
    return;
  }
  loading.value = true;
  try {
    await auth.login(username.value, password.value);
    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/";
    router.push(redirect);
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-page__corner">
      <ThemeToggle />
    </div>

    <div class="stage">
      <!-- 夜书房：台灯 + 光锥 + 桌上光斑 -->
      <div class="scene">
        <div class="lamp" aria-hidden="true">
          <div class="lamp__beam"></div>
          <div class="lamp__shade"><div class="lamp__bulb"></div></div>
          <div class="lamp__stem"></div>
          <div class="lamp__base"></div>
        </div>

        <!-- 登录卡 = 一张信纸 -->
        <div class="login-card">
          <h1 class="logo xz-display">写作台</h1>
          <p class="sub">灯下，把念头写成故事</p>
          <t-form label-align="top" @submit.prevent="onSubmit">
            <t-form-item label="用户名">
              <t-input v-model="username" placeholder="用户名" size="large" />
            </t-form-item>
            <t-form-item label="密码">
              <t-input v-model="password" type="password" placeholder="密码" size="large" @enter="onSubmit" />
            </t-form-item>
            <t-button block size="large" theme="primary" :loading="loading" @click="onSubmit">开 灯 写 作</t-button>
          </t-form>
        </div>

        <div class="desk-pool" aria-hidden="true"></div>
      </div>

      <p class="footnote">设定 · 大纲 · 伏笔 · 时间线 —— 都收在这张桌上</p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--xz-wall);
  overflow: hidden;
}

/* 暗角：四周压暗，光只留给桌面（聚焦感） */
.login-page::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(130% 95% at 50% 32%, transparent 48%, rgba(0, 0, 0, 0.42) 100%);
  pointer-events: none;
}
html[data-theme="day"] .login-page::before {
  background: radial-gradient(130% 95% at 50% 32%, transparent 55%, rgba(84, 70, 46, 0.1) 100%);
}

.login-page__corner {
  position: absolute;
  top: 20px;
  right: 24px;
  z-index: 3;
}

.stage {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0;
}

.scene {
  position: relative;
  width: 460px;
  max-width: 92vw;
}

/* ---------- 台灯（纯装饰：整枝不吃点击，光锥盖到按钮也不拦人） ---------- */
.lamp {
  position: relative;
  height: 96px;
  display: flex;
  justify-content: center;
  z-index: 2;
  pointer-events: none;
}

/* 光锥：从灯罩口向下散开，罩住信纸 */
.lamp__beam {
  position: absolute;
  top: 66px;
  left: 50%;
  transform: translateX(-50%);
  width: 560px;
  height: 640px;
  clip-path: polygon(41.5% 0, 58.5% 0, 86% 100%, 14% 100%);
  background: linear-gradient(180deg, var(--xz-lamp-glow), var(--xz-lamp-wash) 42%, transparent 78%);
  filter: blur(14px);
  z-index: -1;
}

.lamp__shade {
  position: relative;
  width: 128px;
  height: 54px;
  clip-path: polygon(20% 0, 80% 0, 100% 100%, 0 100%);
  background: linear-gradient(180deg, #2d323b 0%, #3a414d 70%, #4a5260 100%);
}
html[data-theme="day"] .lamp__shade {
  background: linear-gradient(180deg, #4a4438 0%, #5c5442 70%, #776c52 100%);
}

.lamp__bulb {
  position: absolute;
  left: 50%;
  bottom: -2px;
  transform: translateX(-50%);
  width: 96px;
  height: 16px;
  border-radius: 50%;
  background: radial-gradient(50% 100% at 50% 0%, var(--xz-lamp-hi), var(--xz-lamp) 60%, transparent);
  filter: blur(2px);
}

.lamp__stem {
  position: absolute;
  left: calc(50% + 58px);
  top: 48px;
  width: 4px;
  height: 62px;
  background: var(--xz-line-2);
  transform: rotate(18deg);
  transform-origin: top;
}

.lamp__base {
  position: absolute;
  left: calc(50% + 80px);
  top: 104px;
  width: 74px;
  height: 12px;
  border-radius: 50%;
  background: linear-gradient(180deg, var(--xz-panel-3), var(--xz-panel-2));
}

/* 桌面光斑：信纸脚下的暖光 */
.desk-pool {
  position: absolute;
  left: 50%;
  bottom: -34px;
  transform: translateX(-50%);
  width: 520px;
  height: 76px;
  border-radius: 50%;
  background: radial-gradient(50% 100% at 50% 50%, var(--xz-lamp-wash), transparent 70%);
  filter: blur(8px);
  pointer-events: none;
}

/* ---------- 信纸卡 ---------- */
.login-card {
  position: relative;
  z-index: 1;
  margin: 18px auto 0;
  width: 384px;
  max-width: 100%;
  padding: 26px 30px 24px;
  background-color: var(--xz-paper);
  /* 信纸横线：标题区干净，行线从副题下方起 */
  background-image: linear-gradient(180deg, rgba(255, 250, 238, 0.55), transparent 26%),
    repeating-linear-gradient(180deg, transparent 0 30px, var(--xz-paper-line) 30px 31px);
  background-position: 0 0, 0 108px;
  border-radius: 2px;
  box-shadow: var(--td-shadow-3);
}

/* 顶部压一道红头线（老信纸） */
.login-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, var(--xz-red) 18% 82%, transparent);
  opacity: 0.55;
}

.logo {
  margin: 0;
  text-align: center;
  font-size: var(--xz-text-brand);
  font-weight: 700;
  color: var(--xz-paper-ink);
}

.sub {
  text-align: center;
  color: var(--xz-paper-ink-2);
  font-size: var(--xz-text-sm);
  letter-spacing: 0.14em;
  margin: 6px 0 26px;
}

/* 信纸上的表单：强制纸色皮肤（脱离全局深色组件底） */
.login-card :deep(.t-form__label) {
  color: var(--xz-paper-ink-2);
}
.login-card :deep(.t-input) {
  background: rgba(255, 253, 247, 0.72);
  border-color: rgba(63, 58, 48, 0.18);
}
.login-card :deep(.t-input--focused) {
  border-color: var(--xz-green);
  box-shadow: 0 0 0 2px var(--xz-green-wash);
}
.login-card :deep(.t-input__inner) {
  color: var(--xz-paper-ink);
}
.login-card :deep(.t-input__inner::placeholder) {
  color: var(--xz-paper-ink-3);
}
.login-card :deep(.t-input__suffix-icon) {
  color: var(--xz-paper-ink-3);
}

.footnote {
  margin: 56px 0 0;
  color: var(--xz-ink-3);
  font-size: var(--xz-text-xs);
  letter-spacing: 0.12em;
  text-align: center;
}
</style>