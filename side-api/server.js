const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const dotenv = require('dotenv');
const baeminController = require('./src/BaeminController');
const coupangController = require('./src/CoupangController');
const ddangyoController = require('./src/DdangyoController');
const session = require('express-session');
const fs = require('fs').promises;
const path = require('path');

// 환경 변수 설정
dotenv.config();

// Stealth 플러그인 사용
puppeteer.use(StealthPlugin());

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // 폼 데이터 파싱을 위한 미들웨어 추가

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
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
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
        await newPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        contextData.page = newPage;
      }
      return contextData;
    } catch (error) {
      // 컨텍스트도 문제가 있으면 새로 생성
      console.log('Context pool item invalid, creating new one');
    }
  }
  
  // 새 컨텍스트 생성
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  
  // 기본 설정
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  return { context, page };
}

// 컨텍스트를 풀로 반환
function returnContext(contextData) {
  try {
    // 페이지가 닫혔는지 확인
    if (contextData.page && !contextData.page.isClosed() && contextPool.length < MAX_CONTEXTS) {
      contextPool.push(contextData);
    } else {
      // 페이지가 닫혔거나 풀이 가득 찬 경우 컨텍스트도 닫기
      if (contextData.context) {
        contextData.context.close();
      }
    }
  } catch (error) {
    console.error('Context return error:', error);
    // 오류 발생 시 컨텍스트 닫기
    try {
      if (contextData.context) {
        contextData.context.close();
      }
    } catch (closeError) {
      console.error('Context close error:', closeError);
    }
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
        if (!contextData.page.isClosed()) {
          await contextData.page.close();
        }
        returnContext(contextData);
      } catch (error) {
        console.error('페이지/컨텍스트 정리 중 오류:', error);
        try {
          if (!contextData.context.isClosed()) {
            await contextData.context.close();
          }
        } catch (closeError) {
          console.error('컨텍스트 닫기 실패:', closeError);
        }
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

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.get('/coupon', (req, res) => {
  const result = req.session.result || '';
  req.session.result = null;
  
  //const pid = 'E713D320D3F44AA8B242FE9E698ED29C'; // 본계
  //const pid = '37D8E62D30A440ACA4D593E2A155315B'; // 부계
  //const pid = '8E31BB1E2CFC4D8C8872C5A675404C26'; // 부계2
  //const pid = '297BC79FCAD844A3AF56C8C545B26C26'; // 부계3
  //const pid = 'AED032FB3CE14B5B988691CD42455252'; // 부계4
  //const pid = '62E8F75AFBC841BAB12F37CB02264D44'; // 백상
  //const pid = 'DE28D55109B04139B01BCEEAE3688CEC'; // 백상부계
  //const pid = 'D2A4A304860F48C196A5C86F706DE3B7'; // 백상부계2
  //const pid = '297BA961A9194117AA67313C91720317'; // 백상부계3

  res.send(`
    <h1>UID 입력</h1>
    <form action="/coupon" method="post">
      <label for="uid">UID:</label>
      <input type="text" id="uid" name="uid" required>
      <button type="submit">쿠폰 적용</button>
      <a href="/coupon">초기화</a>
    </form>
    <div>${result}</div>
  `);
});

app.post('/coupon', async (req, res) => {
  const bomul = {
    1:  "RINKARMA",
    2:  "SECRETCODE",
    3:  "777SENARE",
    4:  "JJOLJACK",
    5:  "LOVESENA",
    6:  "SENAREGOGO",
    7:  "",
    8:  "GOODLUCK",
    9:  "SEVENVSDARK",
    10: "7777777",
    11: "",
    12: "SURPRISE",
    13: "THEMONTHOFSENA",
    14: "",
    15: "7SENASENA7",
    16: "INTOTHESENA",
    17: "",
    18: "REBIRTHBACK",
    19: "WELCOMEBACK",
    20: "",
    21: "",
    22: "",
    23: "LODING",
    24: "GUILDWAR",
    25: "HEROSOMMON",
    26: "",
    27: "INFOCODEX",
    28: "",
    29: "",
    30: "",
    31: "",
    32: "",
    33: "BONVOYAGE",
    34: "",
    35: "INFINITETOWER",
    36: "STORYEVENT",
    37: "EVANKARIN",
    38: "SENARAID",
    39: "WELCOMESENA",
    40: "MOONLIGHTCOAST",
    41: "MOREKEYS",
    42: "SHOWMETHEMONEY",
    43: "",
    44: "MAILBOX",
    45: "",
    46: "RELEASEPET",
    47: "",
    48: "NOHOSCHRONICLE",
    49: "UPDATES",
    50: "THANKYOU",
    51: "SENAHAJASENA",
    52: "",
    53: "",
    54: "",
    55: "FORTAGNIA",
    56: "YUISSONG",
    57: "YONGSANIM",
    58: "PUKIDANCE",
    59: "ADVENTURER",
    60: "",
    61: "",
    62: "LEGENDSRAID",
    63: "SHININGPRISM",
    64: "",
    65: "HTRIBERANES",
    66: "SADENDING",
    67: "TREASURE",
    68: "THEHOLYCROSS",
    69: "VALKYRIE",
    70: "LOVELYRUBY",
    71: "",
    72: "SENAEVENTS",
    73: "CMMAY",
    74: "PDKIMJUNGKI",
    75: "FUSEGETSPECIAL",
    76: "DARKKNIGHTS",
    77: "JULYSENAMONTH",
  };

  const bomulKeys = Object.keys(bomul);

  let coupon = [];
  for (let i=0; i<bomulKeys.length; i++) {
    const key = bomulKeys[i];
    const code = bomul[key];

    if (code === '') continue;
    
    coupon.push({key, code});
  }

  const url = 'https://coupon.netmarble.com/tskgb';
  const pid = req.body.uid;
  const page = req.page;

  console.log(`request body: ${JSON.stringify(req.body)}`);
  console.log(`쿠폰 적용을 위한 페이지로 이동: ${url} (PID: ${pid})`);

  await page.goto(url, { waitUntil: 'networkidle2' });

  let result = [];
  for (const c of coupon) {
    const response = await page.evaluate(async (coupon, pid) => {
      const response = await fetch('https://coupon.netmarble.com/api/coupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          gameCode: 'tskgb',
          couponCode: coupon.code,
          langCd: 'KO_KR',
          pid: pid
        })
      });
      return await response.json();
    }, c, pid);
    result.push({num: c.key, coupon: c.code, message: response.errorMessage || '오류', code: response.errorCode});
  }

  let returnHtml = `<table>
                      <thead>
                        <tr>
                          <th>쿠폰번호</th>
                          <th>쿠폰코드</th>
                          <th>결과</th>
                        </tr>
                      </thead>
                      <tbody>`;
  for (const item of result) {
    returnHtml += `<tr>
                      <td style='border: 1px solid;'>${item.num}</td>
                      <td style='border: 1px solid;'>${item.coupon}</td>
                      <td style='border: 1px solid;'>${item.message}</td>
                    </tr>`;
  }
  returnHtml += `<tr>
                    <td style="border: 1px solid;">합계</td>
                    <td colspan="2" style="border: 1px solid;">총 ${result.filter(t => t.code === 200).length}/${result.length}개 쿠폰 적용</td>
                 </tr>`;
  returnHtml += `</tbody></table>`;

  req.session.result = returnHtml;
  res.redirect('/coupon');
});

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