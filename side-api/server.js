const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const dotenv = require('dotenv');
const baeminController = require('./src/BaeminController');
const coupangController = require('./src/CoupangController');
const ddangyoController = require('./src/DdangyoController');
const yogiyoController = require('./src/YogiyoController');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
// 에러 핸들러 모듈
const errorHandler = require('./src/ErrorHandler');

const AGENT_VERSION = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';

// 환경 변수 설정
dotenv.config();

// Stealth 플러그인 사용
puppeteer.use(StealthPlugin());

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // 폼 데이터 파싱을 위한 미들웨어 추가

app.use(cors());

// 브라우저 인스턴스 관리
let browser;
let contextPool = [];
const MAX_CONTEXTS = 5; // 동시에 사용할 수 있는 최대 컨텍스트 수

// 브라우저 초기화
async function initializeBrowser() {
  try {
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
      ]
    });
    console.log(`browser launched with userDataDir: ${path.join(__dirname, 'puppeteer-profile')}`);
    console.log('Puppeteer 브라우저가 성공적으로 시작되었습니다.');
  } catch (error) {
    console.error('브라우저 시작 실패:', error);
    process.exit(1);
  }
}

// 컨텍스트 풀에서 사용 가능한 컨텍스트 가져오기
async function getContext() {
  if (contextPool.length > 0) {
    const contextData = contextPool.pop();
    
    // 페이지가 닫혔는지 확인
    try {
      if (contextData.page.isClosed()) {
        // 페이지가 닫혔으면 새로 생성
        const newPage = await contextData.context.newPage();
        await newPage.setViewport({ width: 1920, height: 1080 });
        await newPage.setUserAgent(AGENT_VERSION);
        contextData.page = newPage;
      }
      return contextData;
    } catch (error) {
      // 컨텍스트도 문제가 있으면 새로 생성
      console.log('Context pool item invalid, creating new one');
    }
  }
  
  // 새 컨텍스트 생성
  const context = await browser.defaultBrowserContext();
  const page = await context.newPage();

  // 기본 설정
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(AGENT_VERSION);
  
  return { context, page };
}

// 컨텍스트를 풀로 반환
function returnContext(contextData) {
  try {
    // 컨텍스트(브라우저)는 닫지 말고, 페이지만 관리합니다.
    if (contextData.page && !contextData.page.isClosed() && contextPool.length < MAX_CONTEXTS) {
      contextPool.push(contextData);
    } else {
      // 풀이 가득 찼다면 페이지만 닫습니다. (context.close() 호출 금지!)
      if (contextData.page && !contextData.page.isClosed()) {
        contextData.page.close().catch(e => console.error('Page close error:', e));
      }
    }
  } catch (error) {
    console.error('Context return error:', error);
  }
}

// 미들웨어: 각 요청에 대해 페이지 제공
app.use(async (req, res, next) => {
  try {
    const contextData = await getContext();
    
    req.context = contextData.context;
    req.page = contextData.page;
    
    // 응답이 끝나면 페이지를 닫고 컨텍스트를 풀로 반환
    res.on('finish', async () => {
        try {
            // 여기서 페이지를 닫지 않고 바로 returnContext로 보냅니다.
            // returnContext 함수가 이 페이지를 contextPool에 push할 것입니다.
            returnContext(contextData); 
        } catch (error) {
            console.error('컨텍스트 반환 중 오류:', error);
        }
    });
    
    next();
  } catch (error) {
    console.error('컨텍스트 생성 중 오류:', error);
    res.status(500).json({ error: '서버 내부 오류' });
  }
});

app.get('/', (req, res) => {
  res.send('Puppeteer API Server is running!');
});

app.get('/settings', async (req, res) => {
  try {
    const settingsPath = path.join(__dirname, 'settings.json');
    const settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
    res.json(settings);
  } catch (error) {
    console.error('Settings 파일 읽기 오류:', error);
    res.json(null);
  }
});

app.post('/settings', async (req, res) => {
  try {
    const settingsPath = path.join(__dirname, 'settings.json');
    await fs.writeFile(settingsPath, JSON.stringify(req.body, null, 2));
    res.json({ message: '설정이 저장되었습니다.' });
  } catch (error) {
    console.error('Settings 파일 쓰기 오류:', error);
    res.status(500).json({ error: '설정 파일을 저장하는 데 실패했습니다.' });
  }
})

app.use('/baemin', baeminController);
app.use('/coupang', coupangController);
app.use('/ddangyo', ddangyoController);
app.use('/yogiyo', yogiyoController);

app.use(errorHandler);

// 서버 시작
async function startServer() {
  await initializeBrowser();
  
  app.listen(PORT, () => {
    console.log(`Puppeteer 서버가 http://localhost:${PORT}에서 시작되었습니다.`);
  });
}

// 프로세스 종료 시 정리
process.on('SIGINT', async () => {
  console.log('서버를 종료합니다...');
  
  // 모든 컨텍스트 정리
  for (const contextData of contextPool) {
    await contextData.context.close();
  }
  
  if (browser) {
    await browser.close();
  }
  
  process.exit(0);
});

startServer().catch(console.error); 