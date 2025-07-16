# Node.js 18 Alpine 기반 이미지 사용
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 패키지 업데이트 및 필요한 패키지 설치
RUN apk update && apk add --no-cache \
    tzdata \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Timezone 설정
ENV TZ=Asia/Seoul

# package.json과 package-lock.json 복사
COPY package*.json ./

# .env 파일이 있다면 복사
COPY .env ./

# 의존성 설치
RUN npm install --production

# 소스 코드 복사
COPY . .

EXPOSE 3000

# 애플리케이션 실행
CMD ["npm", "start"] 