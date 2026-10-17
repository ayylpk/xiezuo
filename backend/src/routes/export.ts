import { Hono } from "hono";
import { z } from "zod";

import type { AppEnv } from "../app";
import { auth } from "../middleware/auth";
import { exportWork, type ExportFormat } from "../services/export";
import { NotFoundError } from "../services/works";

const router = new Hono<AppEnv>();
router.use("*", auth());

const idParam = z.coerce.number().int().positive();
const FORMATS = ["md", "txt", "json"] as const;

// 导出整本书：GET /api/works/:workId/export?format=md|txt|json
router.get("/works/:workId/export", async (c) => {
  const workId = idParam.safeParse(c.req.param("workId"));
  const format = (c.req.query("format") ?? "md") as ExportFormat;
  if (!workId.success) return c.json({ error: "id 不合法" }, 400);
  if (!FORMATS.includes(format)) return c.json({ error: "format 不合法（可选 md/txt/json）" }, 400);

  try {
    const { filename, mime, body } = await exportWork(c.get("db"), workId.data, format);
    // RFC 5987 filename*：中文文件名在 Content-Disposition 里不乱码
    c.header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return c.body(body, 200, { "content-type": `${mime}; charset=utf-8` });
  } catch (e) {
    if (e instanceof NotFoundError) return c.json({ error: e.message }, 404);
    throw e;
  }
});

export default router;