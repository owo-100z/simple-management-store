# 1) Build 단계
FROM node:22 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# 기본 아웃풋: dist/
RUN npm run build

# 2) Production 단계: nginx로 정적 파일 서빙
FROM nginx:1.26.3
COPY --from=build /app/dist /usr/share/nginx/html
COPY default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80