# SIMPLE_MANAGEMENT_STORE_API

쉬운점포관리 API Server

## 시작하기

이 프로젝트를 로컬에서 실행하려면 다음 단계를 따르세요.

```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo

npm install

docker build -t api-server .
docker run -p 3001:3000 --name api-server api-server
```