import { defineStore } from "pinia";
import { ref } from "vue";

import { api } from "../api/client";

export const ENTITY_TYPES: Record<string, string> = {
  character: "人物",
  scene: "场景",
  world: "世界观",
  idea: "灵感碎片",
};
export type EntityType = keyof typeof ENTITY_TYPES;

export interface Entity {
  id: number;
  workId: number;
  type: EntityType;
  name: string;
  content: string;
  extra: Record<string, string> | null;
  sort: number;
  updatedAt: number;
}

export interface Relation {
  id: number;
  workId: number;
  fromId: number;
  toId: number;
  relType: string;
  note: string;
  fromName: string;
  toName: string;
}

/** 人物卡结构化字段（表单渲染/后端 extra 键口径一致） */
export const CHARACTER_SLOTS = [
  { key: "appearance", label: "外貌" },
  { key: "personality", label: "性格" },
  { key: "goal", label: "目标" },
  { key: "ability", label: "能力" },
];

export const useEntitiesStore = defineStore("entities", () => {
  const entities = ref<Entity[]>([]);
  const relations = ref<Relation[]>([]);
  let workId = 0;

  async function fetchList(wid: number, type?: EntityType) {
    workId = wid;
    const q = type ? `?type=${type}` : "";
    const { entities: list } = await api.get<{ entities: Entity[] }>(`/works/${wid}/entities${q}`);
    entities.value = list;
  }

  async function create(input: { name: string; type: EntityType; content?: string; extra?: Record<string, string> | null }) {
    return api.post<{ entity: Entity }>(`/works/${workId}/entities`, input);
  }

  async function update(id: number, patch: Partial<Omit<Entity, "id" | "workId" | "sort" | "updatedAt">>) {
    return api.patch<{ entity: Entity }>(`/entities/${id}`, patch);
  }

  async function remove(id: number) {
    await api.delete<{ ok: true }>(`/entities/${id}`);
  }

  async function fetchRelations(wid: number) {
    const { relations: list } = await api.get<{ relations: Relation[] }>(`/works/${wid}/relations`);
    relations.value = list;
  }

  async function addRelation(input: { fromId: number; toId: number; relType: string; note?: string }) {
    return api.post<{ relation: Relation }>(`/works/${workId}/relations`, input);
  }

  async function removeRelation(id: number) {
    await api.delete<{ ok: true }>(`/relations/${id}`);
  }

  return { entities, relations, fetchList, create, update, remove, fetchRelations, addRelation, removeRelation };
});