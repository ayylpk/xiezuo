<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { MessagePlugin } from "tdesign-vue-next";

import { useAuthStore } from "../stores/auth";

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
    <t-card class="login-card" :bordered="false">
      <h1 class="logo">写作台</h1>
      <p class="sub">小说创作资料库</p>
      <t-form label-align="top" @submit.prevent="onSubmit">
        <t-form-item label="用户名">
          <t-input v-model="username" placeholder="用户名" size="large" />
        </t-form-item>
        <t-form-item label="密码">
          <t-input v-model="password" type="password" placeholder="密码" size="large" @enter="onSubmit" />
        </t-form-item>
        <t-button block size="large" theme="primary" :loading="loading" @click="onSubmit">登 录</t-button>
      </t-form>
    </t-card>
  </div>
</template>

<style scoped>
.login-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.login-card {
  width: 380px;
  padding: 16px 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}
.logo {
  margin: 0;
  text-align: center;
  font-size: 28px;
}
.sub {
  text-align: center;
  color: var(--td-text-color-secondary);
  margin: 4px 0 24px;
}
</style>