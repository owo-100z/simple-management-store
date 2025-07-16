# 1) Build 단계
FROM node:22 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# 기본 아웃풋: dist/
RUN npm run build

# 2) Production 단계는 nginx 컨테이너에서 마운트
EXPOSE 5173