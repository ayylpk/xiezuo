<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { MessagePlugin } from "tdesign-vue-next";

import { CHARACTER_SLOTS, ENTITY_TYPES, useEntitiesStore, type Entity, type EntityType } from "../stores/entities";

const route = useRoute();
const router = useRouter();
const store = useEntitiesStore();
const workId = Number(route.params.id);

const activeTab = ref<EntityType | "relations">("character");
const loading = ref(true);

// 列表数据
const typeList = ref<Entity[]>([]);

// 新建/编辑 dialog
const dialogVisible = ref(false);
const editId = ref<number | null>(null);
const form = ref({ name: "", content: "", extra: {} as Record<string, string> });

// 关系网
const relForm = ref({ fromId: 0, toId: 0, relType: "", note: "" });
const relDialog = ref(false);

async function load() {
  loading.value = true;
  try {
    if (activeTab.value === "relations") {
      await store.fetchRelations(workId);
    } else {
      await store.fetchList(workId, activeTab.value);
      typeList.value = store.entities.filter((e) => e.type === activeTab.value);
    }
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function openCreate() {
  editId.value = null;
  Object.assign(form.value, { name: "", content: "", extra: {} });
  dialogVisible.value = true;
}

function openEdit(e: Entity) {
  editId.value = e.id;
  Object.assign(form.value, { name: e.name, content: e.content, extra: { ...(e.extra ?? {}) } });
  dialogVisible.value = true;
}

function slotValue(key: string) {
  return form.value.extra[key] ?? "";
}
function setSlot(key: string, v: string) {
  form.value.extra = { ...form.value.extra, [key]: v };
}

async function save() {
  if (!form.value.name.trim()) {
    MessagePlugin.warning("名称不能为空");
    return;
  }
  try {
    const payload = { name: form.value.name.trim(), content: form.value.content, extra: form.value.extra };
    if (editId.value) {
      await store.update(editId.value, payload);
      MessagePlugin.success("已保存");
    } else {
      await store.create({ ...payload, type: activeTab.value as EntityType });
      MessagePlugin.success("已创建");
    }
    dialogVisible.value = false;
    load();
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}

async function removeEntity(e: Entity) {
  if (!window.confirm(`删除「${e.name}」？关联关系一并清除`)) return;
  try {
    await store.remove(e.id);
    MessagePlugin.success("已删除");
    load();
  } catch (err) {
    MessagePlugin.error((err as Error).message);
  }
}

async function saveRelation() {
  if (!relForm.value.fromId || !relForm.value.toId || !relForm.value.relType) {
    MessagePlugin.warning("请选择两端实体并填写关系");
    return;
  }
  try {
    await store.addRelation({ ...relForm.value, note: relForm.value.note });
    MessagePlugin.success("关系已建立");
    relDialog.value = false;
    relForm.value = { fromId: 0, toId: 0, relType: "", note: "" };
    load();
  } catch (e) {
    MessagePlugin.error((e as Error).message);
  }
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <t-button variant="text" @click="router.push(`/works/${workId}`)">← 作品</t-button>
      <span class="title">设定库</span>
      <t-button theme="primary" @click="activeTab === 'relations' ? (relDialog = true) : openCreate()">
        {{ activeTab === "relations" ? "+ 建关系" : "+ 新建" }}
      </t-button>
    </header>

    <main class="body">
      <t-tabs v-model="activeTab" @change="load">
        <t-tab-panel v-for="(label, key) in ENTITY_TYPES" :key="key" :value="key" :label="label">
          <t-list v-if="!loading" class="cards-list">
            <t-list-item v-for="e in typeList" :key="e.id">
              <t-space direction="vertical" class="cell">
                <b>{{ e.name }}</b>
                <span class="gray">{{ e.content || "（无描述）" }}</span>
                <t-space v-if="e.extra" size="4">
                  <t-tag v-for="(v, k) in e.extra" :key="k" variant="light" size="small">
                    {{ CHARACTER_SLOTS.find((s) => s.key === k)?.label ?? k }}：{{ v }}
                  </t-tag>
                </t-space>
              </t-space>
              <t-space>
                <t-button variant="text" size="small" @click="openEdit(e)">编辑</t-button>
                <t-button variant="text" theme="danger" size="small" @click="removeEntity(e)">删</t-button>
              </t-space>
            </t-list-item>
          </t-list>
          <div v-else-if="typeList.length === 0" class="empty">此分类还没有条目</div>
        </t-tab-panel>

        <t-tab-panel value="relations" label="关系网">
          <t-list v-if="!loading">
            <t-list-item v-for="r in store.relations" :key="r.id">
              <span class="rel-line">
                <t-tag theme="primary" variant="light">{{ r.fromName }}</t-tag>
                <t-tag theme="warning" variant="outline" class="rel-type">{{ r.relType }}</t-tag>
                <t-tag theme="primary" variant="light">{{ r.toName }}</t-tag>
                <span class="gray note">{{ r.note }}</span>
              </span>
              <t-button variant="text" theme="danger" size="small" @click="store.removeRelation(r.id).then(load)">删</t-button>
            </t-list-item>
          </t-list>
          <div v-else class="empty">还没有关系，点右上角「建关系」</div>
        </t-tab-panel>
      </t-tabs>
    </main>

    <!-- 新建/编辑条目 -->
    <t-dialog v-model:visible="dialogVisible" :header="editId ? '编辑条目' : `新建${ENTITY_TYPES[activeTab as EntityType] ?? '条目'}`" width="520" :footer="false">
      <t-form label-align="top">
        <t-form-item label="名称">
          <t-input v-model="form.name" placeholder="名称" maxlength="64" />
        </t-form-item>
        <template v-if="activeTab === 'character'">
          <t-form-item v-for="slot in CHARACTER_SLOTS" :key="slot.key" :label="slot.label">
            <t-input :model-value="slotValue(slot.key)" @update:model-value="(v: string) => setSlot(slot.key, v)" placeholder="可留空" />
          </t-form-item>
        </template>
        <t-form-item :label="activeTab === 'character' ? '备注/经历' : '描述'">
          <t-textarea v-model="form.content" :autosize="{ minRows: 3 }" maxlength="20000" />
        </t-form-item>
        <t-button block theme="primary" @click="save">保存</t-button>
      </t-form>
    </t-dialog>

    <!-- 建关系 -->
    <t-dialog v-model:visible="relDialog" header="建立关系" width="460" :footer="false">
      <t-form label-align="top">
        <t-form-item label="从">
          <t-select v-model="relForm.fromId" placeholder="选择实体">
            <t-option v-for="e in store.entities" :key="e.id" :value="e.id" :label="e.name" />
          </t-select>
        </t-form-item>
        <t-form-item label="关系">
          <t-input v-model="relForm.relType" placeholder="如：青梅竹马 / 敌对 / 师徒" maxlength="32" />
        </t-form-item>
        <t-form-item label="到">
          <t-select v-model="relForm.toId" placeholder="选择实体">
            <t-option v-for="e in store.entities" :key="e.id" :value="e.id" :label="e.name" />
          </t-select>
        </t-form-item>
        <t-form-item label="备注（可选）">
          <t-input v-model="relForm.note" maxlength="1000" />
        </t-form-item>
        <t-button block theme="primary" @click="saveRelation">建立</t-button>
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
.cell {
  flex: 1;
}
.gray {
  color: var(--td-text-color-placeholder);
  font-size: 12px;
}
.empty {
  padding: 60px 0;
  text-align: center;
  color: var(--td-text-color-placeholder);
}
.rel-line {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}
.rel-type {
  margin: 0 4px;
}
.note {
  margin-left: 8px;
}
</style>