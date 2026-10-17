<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { DialogPlugin, MessagePlugin } from "tdesign-vue-next";

import { CHARACTER_SLOTS, ENTITY_TYPES, useEntitiesStore, type Entity, type EntityType } from "../stores/entities";
import WorkShell from "../components/WorkShell.vue";
import EmptyState from "../components/EmptyState.vue";

const route = useRoute();
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

const isRelations = computed(() => activeTab.value === "relations");

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

/** 删除条目：DialogPlugin（关系连带清除要写进确认文案） */
function confirmRemove(e: Entity) {
  const dlg = DialogPlugin.confirm({
    header: `删除「${e.name}」`,
    body: "与它相关的所有关系也会一并清除，不可恢复。",
    theme: "warning",
    confirmBtn: { content: "确认删除", variant: "base" },
    onConfirm: async () => {
      try {
        await store.remove(e.id);
        MessagePlugin.success("已删除");
        load();
      } catch (err) {
        MessagePlugin.error((err as Error).message);
      } finally {
        dlg.destroy();
      }
    },
  });
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

function confirmRemoveRelation(r: { id: number; fromName: string; relType: string; toName: string }) {
  const dlg = DialogPlugin.confirm({
    header: "解除这条关系",
    body: `「${r.fromName} —${r.relType}→ ${r.toName}」将被删除。`,
    theme: "warning",
    confirmBtn: { content: "解除", variant: "base" },
    onConfirm: async () => {
      try {
        await store.removeRelation(r.id);
        MessagePlugin.success("已解除");
        load();
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
      <t-button theme="primary" @click="isRelations ? (relDialog = true) : openCreate()">
        {{ isRelations ? "+ 建关系" : "+ 新建" }}
      </t-button>
    </template>

    <t-tabs v-model="activeTab" @change="load" class="ent-tabs">
      <t-tab-panel v-for="(label, key) in ENTITY_TYPES" :key="key" :value="key" :label="label">
        <section class="xz-panel">
          <EmptyState
            v-if="!loading && typeList.length === 0"
            :title="`「${label}」还空着`"
            hint="设定是写给 80 章之后的自己的——今天偷懒一笔，将来就要回头重读三万字"
          >
            <t-button theme="primary" @click="openCreate">新建第一条{{ label }}</t-button>
          </EmptyState>

          <div v-else class="xz-rows">
            <div v-for="e in typeList" :key="e.id" class="xz-row ent">
              <div class="ent__main" tabindex="0" @click="openEdit(e)" @keydown.enter="openEdit(e)">
                <span class="ent__name">{{ e.name }}</span>
                <span v-if="e.content" class="ent__desc">{{ e.content }}</span>
              </div>
              <t-space v-if="e.extra && Object.keys(e.extra).length" size="4" class="ent__slots">
                <t-tag v-for="(v, k) in e.extra" :key="k" variant="outline" size="small">
                  {{ CHARACTER_SLOTS.find((s) => s.key === k)?.label ?? k }}：{{ v }}
                </t-tag>
              </t-space>
              <t-button variant="text" size="small" @click="openEdit(e)">编辑</t-button>
              <t-button variant="text" theme="danger" size="small" @click="confirmRemove(e)">删除</t-button>
            </div>
          </div>
        </section>
      </t-tab-panel>

      <t-tab-panel value="relations" label="关系网">
        <section class="xz-panel">
          <EmptyState
            v-if="!loading && store.relations.length === 0"
            title="还没有关系"
            hint="人物之间的线拉起来，冲突和羁绊才有地方长——右上角「建关系」"
          >
            <t-button theme="primary" @click="relDialog = true">拉起第一条关系</t-button>
          </EmptyState>

          <div v-else class="xz-rows">
            <div v-for="r in store.relations" :key="r.id" class="xz-row rel">
              <span class="rel__line">
                <span class="rel__name">{{ r.fromName }}</span>
                <span class="rel__type">{{ r.relType }}</span>
                <span class="rel__name">{{ r.toName }}</span>
                <span v-if="r.note" class="rel__note">{{ r.note }}</span>
              </span>
              <t-button variant="text" theme="danger" size="small" @click="confirmRemoveRelation(r)">解除</t-button>
            </div>
          </div>
        </section>
      </t-tab-panel>
    </t-tabs>

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
  </WorkShell>
</template>

<style scoped>
.ent-tabs :deep(.t-tabs__nav) {
  margin-bottom: 16px;
}

/* 条目行 */
.ent__main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 12px;
  cursor: pointer;
  outline: none;
}
.ent__name {
  font-family: "STKaiti", "KaiTi", "Noto Serif SC", serif;
  font-size: var(--xz-text-h3);
  color: var(--xz-ink);
  flex-shrink: 0;
}
.ent__main:hover .ent__name {
  color: var(--xz-green);
}
.ent__desc {
  min-width: 0;
  color: var(--xz-ink-3);
  font-size: var(--xz-text-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ent__slots {
  flex-shrink: 0;
}

/* 关系行：A —关系→ B，关系是灯橙的连接器 */
.rel__line {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
}
.rel__name {
  font-family: "STKaiti", "KaiTi", "Noto Serif SC", serif;
  font-size: var(--xz-text-h3);
  color: var(--xz-ink);
}
.rel__type {
  padding: 1px 10px;
  border: 1px solid var(--xz-lamp);
  border-radius: 999px;
  color: var(--xz-lamp);
  font-size: var(--xz-text-xs);
  letter-spacing: 0.05em;
  flex-shrink: 0;
}
.rel__note {
  color: var(--xz-ink-3);
  font-size: var(--xz-text-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .ent__desc,
  .ent__slots,
  .rel__note {
    display: none;
  }
}
</style>
