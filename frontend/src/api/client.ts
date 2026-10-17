/**
 * 统一 API 客户端：
 * - 同源 fetch，cookie 由浏览器自动携带（HttpOnly 不落地 JS）
 * - 统一 JSON 解析与错误包装
 * - 401 时派发全局事件，由 App.vue 统一登出跳转（解耦，store 不反向依赖 client）
 */
const BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    ...opts,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(opts.headers ?? {}) },
  });

  if (resp.status === 401 && !path.startsWith("/auth/login")) {
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }

  const body = (await resp.json().catch(() => null)) as { error?: string } | null;
  if (!resp.ok) {
    throw new ApiError(resp.status, body?.error ?? `请求失败(${resp.status})`);
  }
  return body as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, data?: unknown) =>
    request<T>(p, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) }),
  patch: <T>(p: string, data: unknown) => request<T>(p, { method: "PATCH", body: JSON.stringify(data) }),
  delete: <T>(p: string) => request<T>(p, { method: "DELETE" }),
};