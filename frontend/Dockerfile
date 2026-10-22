# 写作台前端（Vue 3 + Vite）→ 静态文件交给 nginx
#
# 两阶段：node 负责构建，最终镜像只留 dist + nginx，不带 node_modules。
# 基础镜像走 DaoCloud 国内源（官方镜像也不用加 library/ 前缀）。
# 换回官方只要删掉前缀，写成 node:22-alpine / nginx:alpine。
FROM docker.m.daocloud.io/node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
# 服务器在国内，默认 registry.npmjs.org 拉包极慢（首次构建会卡十几分钟甚至超时）。
# replace-registry-host=always 让 npm 把 lock 里写死的 registry.npmjs.org 也改写成镜像源，
# 否则 npm ci 仍会照着 lock 里的 resolved 地址去拉，换 registry 等于白换。
RUN npm config set registry https://registry.npmmirror.com \
 && npm config set replace-registry-host always \
 && npm ci

COPY . .
# vue-tsc -b && vite build：类型错误会让镜像构建直接失败，等价于一次免费的类型检查
RUN npm run build

FROM docker.m.daocloud.io/nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
