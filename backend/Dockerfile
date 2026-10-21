# 写作台后端（Bun + Hono + SQLite）
#
# 不装 devDependencies：运行只需要 drizzle-orm / hono / zod，测试在 CI 里跑。
# 数据目录由 compose 挂到 /app/data；DB_PATH 指过去，db.ts 会自己 mkdir -p。
# 基础镜像走 DaoCloud 国内源：Docker Hub 直连在本机/腾讯云都要几十分钟才拉得下来。
# 换回官方只要删掉前缀，写成 oven/bun:1-alpine 即可。
FROM docker.m.daocloud.io/oven/bun:1-alpine

WORKDIR /app

# 先只拷依赖清单，让这层能被缓存（改源码不重装依赖）
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/xiezuo.db

RUN mkdir -p /app/data

EXPOSE 3000

# 用 root 跑：个人单机部署，bind mount 的 ./data 属主是宿主机用户，
# 换成非 root（uid 1000）会写不进 SQLite 文件，反而多一层权限坑。
# 要加固就自己建用户，并把 ./data 的属主 chown 成它。
# 单进程：SQLite 单文件写 + 单用户场景，不要开多副本。
CMD ["bun", "src/index.ts"]
