<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { MessagePlugin } from "tdesign-vue-next";

import { useOutlinesStore, type Outline } from "../stores/outlines";

const route = useRoute();
const router = useRouter();
const store = useOutlinesStore();
const workId = Number(route.params.id);

const dialogVisible = ref(false);
const editId = ref<number | null>(null);
const parentOptions = ref<Outline[]>([]); // 可成为父节点的候选（卷/章级）
const form = ref({ title: "", content: "", parentId: null as number | null });

const tree = computed(() => store.tree());
const depth = (node: Outline) => {
  let d = 0;
  let cur: Outline | null = node;
  while (cur && cur.parentId) {
    d++;
    cur = store.outlines.find((o) => o.id === cur!.parentId) ?? null;
  }
  return d;
};

onMounted(() => store.fetchList(workId).catch((e) => MessagePlugin.error(e.message)));

function openCreate(parentId: number | null = null) {
  editId.value = null;
  // 父子配对：只允许根卷挂根、子节点挂任何已存在节点
  parentOptions.value = store.outlines;
  Object.assign(form.value, { title: "", content: "", parentId });
  dialogVisible.value = true;
}

function openEdit(o: Outline) {
  editId.value = o.id;
  parentOptions.value = store.outlines.filter((x) => x.id !== o.id);
  Object.assign(form.value, { title: o.title, content: o.content, parentId: null });
  dialogVisible.value = true;
}

async function save() {
  if (!form.value.title.trim()) {
    MessagePlugin.warning("标题不能为空");
    return;
  }
  try {
    if (editId.value) {
      await store.update(editId.value, { title: form.value.title.trim(), content: form.value.content });
    } else {
      await store.create({
        title: form.value.title.trim(),
        content: form.value.content,
        parentId: form.value.parentId === null ? undefined : form.value.parentId,
      });
    }
    MessagePlugin.success(editId.value ? "已保存" : "已创建");
    dialogVisible.value = false;
    store.fetchList(workId);
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}

async function removeOutline(o: Outline) {
  const child = store.outlines.some((x) => x.parentId === o.id);
  if (!window.confirm(`删除「${o.title}」${child ? "及其全部子节点" : ""}？`)) return;
  try {
    await store.remove(o.id);
    MessagePlugin.success("已删除");
    store.fetchList(workId);
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <t-button variant="text" @click="router.push(`/works/${workId}`)">← 作品</t-button>
      <span class="title">大纲</span>
      <t-button theme="primary" @click="openCreate()">+ 新建卷</t-button>
    </header>

    <main class="body">
      <div v-if="tree.length === 0" class="empty">还没有大纲，点右上角「新建卷」开始（卷 → 章 → 细纲三级）</div>

      <!-- 递归渲染：模板内联自引用组件 -->
      <template v-for="group in tree" :key="group.node.id">
        <div class="row" :style="{ paddingLeft: depth(group.node) * 24 + 8 + 'px' }">
          <t-button variant="text" size="small" @click="openEdit(group.node)" class="node-title">{{ group.node.title }}</t-button>
          <t-button variant="text" size="small" @click="openCreate(group.node.id)">+子</t-button>
          <t-button variant="text" theme="danger" size="small" @click="removeOutline(group.node)">删</t-button>
          <span v-if="group.node.content" class="gray">{{ group.node.content.slice(0, 40) }}</span>
        </div>
        <template v-for="child in group.children" :key="child.node.id">
          <div class="row" :style="{ paddingLeft: depth(child.node) * 24 + 8 + 'px' }">
            <t-button variant="text" size="small" @click="openEdit(child.node)" class="node-title">{{ child.node.title }}</t-button>
            <t-button variant="text" size="small" @click="openCreate(child.node.id)">+子</t-button>
            <t-button variant="text" theme="danger" size="small" @click="removeOutline(child.node)">删</t-button>
            <span v-if="child.node.content" class="gray">{{ child.node.content.slice(0, 40) }}</span>
          </div>
          <div v-for="grand in child.children" :key="grand.node.id" class="row" :style="{ paddingLeft: depth(grand.node) * 24 + 8 + 'px' }">
            <t-button variant="text" size="small" @click="openEdit(grand.node)" class="node-title">{{ grand.node.title }}</t-button>
            <t-button variant="text" theme="danger" size="small" @click="removeOutline(grand.node)">删</t-button>
            <span v-if="grand.node.content" class="gray">{{ grand.node.content.slice(0, 40) }}</span>
          </div>
        </template>
      </template>
    </main>

    <t-dialog v-model:visible="dialogVisible" :header="editId ? '编辑节点' : '新建节点'" width="520" :footer="false">
      <t-form label-align="top">
        <t-form-item label="标题">
          <t-input v-model="form.title" maxlength="128" />
        </t-form-item>
        <t-form-item v-if="!editId" label="挂到（留空为顶层卷）">
          <t-select v-model="form.parentId" :options="parentOptions.map((o) => ({ value: o.id, label: o.title }))" clearable placeholder="顶层" />
        </t-form-item>
        <t-form-item label="内容 / 细纲">
          <t-textarea v-model="form.content" :autosize="{ minRows: 3 }" maxlength="20000" placeholder="这层要发生什么、点睛之笔、注意点…" />
        </t-form-item>
        <t-button block theme="primary" @click="save">保存</t-button>
      </t-form>
    </t-dialog>
  </div>
</template>

<style scoped>
.page {
  min-height: 100%;
}
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 32px;
  background: #fff;
  border-bottom: 1px solid var(--td-component-stroke);
}
.title {
  font-weight: 600;
}
.body {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 32px;
}
.row {
  display: flex;
  align-items: center;
  gap: 4px;
  border-bottom: 1px dashed var(--td-component-stroke);
  padding-top: 2px;
  padding-bottom: 2px;
}
.node-title {
  font-weight: 500;
}
.gray {
  color: var(--td-text-color-placeholder);
  font-size: 12px;
  margin-left: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 420px;
}
.empty {
  padding: 60px 0;
  text-align: center;
  color: var(--td-text-color-placeholder);
}
</style>