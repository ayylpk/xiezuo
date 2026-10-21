# 写作台前端（Vue 3 + Vite）→ 静态文件交给 nginx
#
# 两阶段：node 负责构建，最终镜像只留 dist + nginx，不带 node_modules。
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# vue-tsc -b && vite build：类型错误会让镜像构建直接失败，等价于一次免费的类型检查
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
