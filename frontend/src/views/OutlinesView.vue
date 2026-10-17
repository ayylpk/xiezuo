<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { DialogPlugin, MessagePlugin } from "tdesign-vue-next";

import { useOutlinesStore, type Outline } from "../stores/outlines";
import WorkShell from "../components/WorkShell.vue";
import EmptyState from "../components/EmptyState.vue";

const route = useRoute();
const store = useOutlinesStore();
const workId = Number(route.params.id);

const dialogVisible = ref(false);
const editId = ref<number | null>(null);
const parentOptions = ref<Outline[]>([]); // 可成为父节点的候选（卷/章级）
const form = ref({ title: "", content: "", parentId: null as number | null });

const tree = computed(() => store.tree());

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

/** 删除节点：有子节点时文案警告连带数量（原生 confirm 换 DialogPlugin） */
function confirmRemove(o: Outline) {
  const childCount = store.outlines.filter((x) => x.parentId === o.id).length;
  const dlg = DialogPlugin.confirm({
    header: `删除「${o.title}」`,
    body: childCount > 0 ? `它下面还挂着 ${childCount} 个子节点，会一并删除，不可恢复。` : "这个节点没有子内容，删除不可恢复。",
    theme: "warning",
    confirmBtn: { content: "确认删除", variant: "base" },
    onConfirm: async () => {
      try {
        await store.remove(o.id);
        MessagePlugin.success("已删除");
        store.fetchList(workId);
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
      <t-button theme="primary" @click="openCreate()">+ 新建卷</t-button>
    </template>

    <section class="xz-panel">
      <EmptyState
        v-if="tree.length === 0"
        title="大纲还是白纸"
        hint="先立一卷，再拆章，最后落到细纲——三级各管各的粒度，写到哪算哪"
      >
        <t-button theme="primary" @click="openCreate()">立第一卷</t-button>
      </EmptyState>

      <!-- 递归渲染：模板内联自引用，三层缩进 + 层级导线 -->
      <div v-else class="tree">
        <template v-for="group in tree" :key="group.node.id">
          <div class="node node--vol" :style="{ paddingLeft: 16 + 'px' }">
            <button class="node__title" @click="openEdit(group.node)">{{ group.node.title }}</button>
            <span v-if="group.node.content" class="node__preview">{{ group.node.content }}</span>
            <span class="node__ops">
              <t-button variant="text" size="small" @click="openCreate(group.node.id)">+子</t-button>
              <t-button variant="text" theme="danger" size="small" @click="confirmRemove(group.node)">删除</t-button>
            </span>
          </div>
          <template v-for="child in group.children" :key="child.node.id">
            <div class="node node--chap" :style="{ paddingLeft: 40 + 'px' }">
              <button class="node__title" @click="openEdit(child.node)">{{ child.node.title }}</button>
              <span v-if="child.node.content" class="node__preview">{{ child.node.content }}</span>
              <span class="node__ops">
                <t-button variant="text" size="small" @click="openCreate(child.node.id)">+子</t-button>
                <t-button variant="text" theme="danger" size="small" @click="confirmRemove(child.node)">删除</t-button>
              </span>
            </div>
            <div v-for="grand in child.children" :key="grand.node.id" class="node node--beat" :style="{ paddingLeft: 64 + 'px' }">
              <button class="node__title" @click="openEdit(grand.node)">{{ grand.node.title }}</button>
              <span v-if="grand.node.content" class="node__preview">{{ grand.node.content }}</span>
              <span class="node__ops">
                <t-button variant="text" theme="danger" size="small" @click="confirmRemove(grand.node)">删除</t-button>
              </span>
            </div>
          </template>
        </template>
      </div>
    </section>

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
  </WorkShell>
</template>

<style scoped>
.tree {
  padding: 6px 0;
}

/* 树节点行：卷有分隔线，层级靠缩进 + 导线（左竖线）表达 */
.node {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 16px 9px 16px;
  position: relative;
  transition: background-color 0.14s ease;
}
.node:hover {
  background: var(--xz-panel-2);
}
.node--vol {
  border-top: 1px solid var(--xz-line);
}
.node--vol:first-child {
  border-top: none;
}
/* 子层导线：缩进区左侧一条细线，卷末行不拖尾 */
.node--chap::before,
.node--beat::before {
  content: "";
  position: absolute;
  left: 26px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--xz-line);
}
.node--beat::before {
  left: 50px;
}

.node__title {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  text-align: left;
  color: var(--xz-ink);
  font-family: inherit;
  outline: none;
  flex-shrink: 0;
  max-width: 46%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.node--vol > .node__title {
  font-family: "STKaiti", "KaiTi", "Noto Serif SC", serif;
  font-size: var(--xz-text-h3);
  font-weight: 700;
  letter-spacing: 0.05em;
}
.node--chap > .node__title {
  font-size: var(--xz-text-body);
  font-weight: 500;
}
.node--beat > .node__title {
  font-size: var(--xz-text-sm);
  color: var(--xz-ink-2);
}
.node__title:hover {
  color: var(--xz-green);
}

.node__preview {
  flex: 1;
  min-width: 0;
  color: var(--xz-ink-3);
  font-size: var(--xz-text-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.node__ops {
  flex-shrink: 0;
  display: flex;
  gap: 2px;
  margin-left: auto;
}

@media (max-width: 720px) {
  .node__preview {
    display: none;
  }
}
</style>
