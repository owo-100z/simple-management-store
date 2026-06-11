const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const cron = require('node-cron'); // 1. node-cron 라이브러리 추가

const menuRouter     = require('./src/routes/menuRouter');
const soldoutRouter  = require('./src/routes/soldoutRouter');
const pauseRouter    = require('./src/routes/pauseRouter');
const scheduleRouter = require('./src/routes/scheduleRouter');
const settingsRouter = require('./src/routes/settingsRouter');
const errorHandler   = require('./src/middleware/errorHandler');
const { initDB }     = require('./src/db/database');
const SoldoutScheduler = require('./src/scheduler/SoldoutScheduler');

dotenv.config();
puppeteer.use(StealthPlugin());

const PORT         = process.env.PORT || 3000;
const AGENT_VERSION = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
const COOKIES_DIR  = path.join(__dirname, 'cookies');
const SERVICES     = ['baemin', 'coupang', 'ddangyo', 'yogiyo'];

let serviceContexts = {}; // 재할당을 위해 const에서 let으로 변경
let browser;
let isResetting = false;  // 2. 브라우저 재시작 중 외부 요청 유입을 방어할 플래그

// ─────────────────────────────────────────────
// 쿠키 저장/로드
// ─────────────────────────────────────────────
async function saveCookies(service, page) {
  try {
    await fs.mkdir(COOKIES_DIR, { recursive: true });
    const cookies = await page.cookies();
    await fs.writeFile(
      path.join(COOKIES_DIR, `${service}.json`),
      JSON.stringify(cookies, null, 2)
    );
  } catch (e) {
    console.error(`[${service}] 쿠키 저장 실패:`, e.message);
  }
}

async function loadCookies(service, page) {
  try {
    const raw = await fs.readFile(path.join(COOKIES_DIR, `${service}.json`), 'utf8');
    const cookies = JSON.parse(raw);
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
      console.log(`[${service}] 쿠키 로드 완료 (${cookies.length}개)`);
    }
  } catch {
    console.log(`[${service}] 저장된 쿠키 없음 - 로그인 필요`);
  }
}

// ─────────────────────────────────────────────
// 페이지 공통 설정
// ─────────────────────────────────────────────
async function setupPage(page) {
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(AGENT_VERSION);
//   await page.setRequestInterception(true);
//   page.on('request', (req) => {
//     // 렌더링 구조 깨짐 방지를 위해 stylesheet는 제외
//     if (['image', 'font', 'media'].includes(req.resourceType())) {
//       req.abort();
//     } else {
//       req.continue();
//     }
//   });
}

// ─────────────────────────────────────────────
// 브라우저 + 서비스별 컨텍스트 초기화
// ─────────────────────────────────────────────
async function initializeBrowser() {
  browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    userDataDir: path.join(__dirname, 'puppeteer-profile'),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--window-size=1920,1080',
    ],
  });

  console.log('Chromium 실행 완료');

  for (const service of SERVICES) {
    const context = await browser.createBrowserContext();
    const page    = await context.newPage();
    await setupPage(page);
    await loadCookies(service, page);
    serviceContexts[service] = { context, page };
    console.log(`[${service}] 컨텍스트 초기화 완료`);
  }
}

// ─────────────────────────────────────────────
// req에 serviceContexts, saveCookies 주입
// ─────────────────────────────────────────────
function injectContexts(req, res, next) {
  // 3. 브라우저 교체 타임(약 3~5초)에 요청이 들어오면 대기하도록 거름망 역할
  if (isResetting) {
    return res.status(503).json({ 
      status: 'error', 
      message: '서버 정기 리프레시 중입니다. 잠시 후 다시 시도해 주세요.' 
    });
  }
  req.serviceContexts = serviceContexts;
  req.saveCookies     = saveCookies;
  next();
}

// ─────────────────────────────────────────────
// Express 앱
// ─────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(injectContexts);

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running!' });
});

app.use('/api/menu',     menuRouter);
app.use('/api/soldout',  soldoutRouter);
app.use('/api/pause',    pauseRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/settings', settingsRouter);

app.use(errorHandler);

// ─────────────────────────────────────────────
// 전역 오류 처리
// ─────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// ─────────────────────────────────────────────
// 세션 주기적 갱신 (30분)
// ─────────────────────────────────────────────
function startSessionKeepAlive() {
  setInterval(async () => {
    for (const service of SERVICES) {
      const ctx = serviceContexts[service];
      if (ctx?.page && !ctx.page.isClosed()) {
        try {
          // 단순히 쿠키 저장이 아니라, 실제 새로고침을 해서 세션을 연장시킴
          console.log(`[${service}] 세션 유지를 위해 페이지 새로고침 중...`);
          await ctx.page.reload({ waitUntil: 'domcontentloaded' });
          await saveCookies(service, ctx.page);
        } catch (e) {
          console.error(`[${service}] 세션 유지 실패:`, e.message);
        }
      }
    }
  }, 1000 * 60 * 30); // 30분마다 실행
}

// ─────────────────────────────────────────────
// [추가] 새벽 4시 브라우저 프로세스 클린업 함수
// ─────────────────────────────────────────────
async function resetBrowser() {
  if (isResetting) return;
  isResetting = true;
  console.log('🧹 [새벽 스케줄러] 좀비 브라우저 정리 및 메모리 초기화 시작...');

  try {
    SoldoutScheduler.stop();

    for (const service of SERVICES) {
      const ctx = serviceContexts[service];
      if (ctx) {
        await saveCookies(service, ctx.page).catch(() => {});
        await ctx.context.close().catch(() => {});
      }
    }
    serviceContexts = {}; // 참조 끊기

    if (browser) {
      await browser.close().catch(() => {});
      browser = null;
    }
    console.log('💤 기존 Chromium 프로세스 완전히 정상 종료됨.');

    // 완전 새것 상태로 브라우저 기동
    await initializeBrowser();

    SoldoutScheduler.setContexts(serviceContexts);
    SoldoutScheduler.start();

    console.log('✨ [새벽 스케줄러] 브라우저 세션 리프레시 성공.');
  } catch (err) {
    console.error('🚨 [새벽 스케줄러] 브라우저 리프레시 중 실패:', err);
  } finally {
    isResetting = false; // 플래그 해제
  }
}

// ─────────────────────────────────────────────
// [추가] 매일 새벽 4시 node-cron 등록
// ─────────────────────────────────────────────
function startDailyResetScheduler() {
  // 초 분 시 일 월 요일 (매일 04:00:00 실행)
  cron.schedule('0 0 4 * * *', async () => {
    await resetBrowser();
  }, {
    scheduled: true,
    timezone: "Asia/Seoul" // 한국 표준시 강제 설정
  });
  console.log('⏰ 매일 새벽 4시 브라우저 정기 재시작 크론 스케줄러 등록 완료');
}

// ─────────────────────────────────────────────
// 종료 시 정리
// ─────────────────────────────────────────────
async function cleanup() {
  console.log('서버 종료 중...');
  SoldoutScheduler.stop();
  for (const service of SERVICES) {
    const ctx = serviceContexts[service];
    if (ctx) {
      await saveCookies(service, ctx.page).catch(() => {});
      await ctx.context.close().catch(() => {});
    }
  }
  if (browser) await browser.close().catch(() => {});
  process.exit(0);
}

process.on('SIGINT',  cleanup);
process.on('SIGTERM', cleanup);

// ─────────────────────────────────────────────
// 서버 시작
// ─────────────────────────────────────────────
async function startServer() {
  try {
    await initDB();
    await initializeBrowser();

    // 스케줄러에 컨텍스트 주입 후 시작
    SoldoutScheduler.setContexts(serviceContexts);
    SoldoutScheduler.start();

    startSessionKeepAlive();
    startDailyResetScheduler(); // 4. 서버 기동 시 크론 스케줄러 함께 작동

    app.listen(PORT, () => {
      console.log(`서버 시작: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('서버 시작 실패:', err);
    process.exit(1);
  }
}

startServer();