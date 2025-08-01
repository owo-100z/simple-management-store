const fs = require('fs').promises;
const path = require('path');

// 캐시 설정
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24시간 (하루)

// 서비스별 쿠키 경로
const COOKIE_PATHS = {
    baemin: path.join(__dirname, 'baemin-cookies.json'),
    coupang: path.join(__dirname, 'coupang-cookies.json'),
    ddangyo: path.join(__dirname, 'ddangyo-cookies.json'),
};

// 서비스별 캐시를 하나의 객체로 관리
let cache = {
    baemin: {
        shopInfo: { data: null, timestamp: null },
        menuList: { data: null, timestamp: null },
    },
    coupang: {
        shopInfo: { data: null, timestamp: null },
        menuList: { data: null, timestamp: null },
    },
    ddangyo: {
        shopInfo: { data: null, timestamp: null },
        menuList: { data: null, timestamp: null },
    },
};

// 서비스별 fetchFunctions 정의
let fetchFunctions = {
    baemin: {},
    coupang: {},
    ddangyo: {},
};

/**
 * 객체를 쿼리스트링으로 변환하는 함수
 * @param {object} params - 변환할 객체
 * @returns {string} - 쿼리스트링 (예: 'a=1&b=2')
 */
function toQueryString(params) {
    if (!params) {
        return '';
    }
    return '?' + Object.entries(params)
        .filter(([key, value]) => value !== undefined && value !== null)
        .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value))
        .join('&');
}

/**
 * 페이지 이동 함수
 * @param {object} page - Puppeteer Page 인스턴스
 * @param {string} url - 이동할 URL
 * @returns {Promise<any>} - 페이지 이동 결과
 */
async function goto(page, url, timeout = 30000) {
    log(`[goto] url: ${url}`);

    try {
        return await page.goto(url, { waitUntil: 'networkidle2', timeout });
    } catch (error) {
        throw error;
    }
}

/**
 * 공통 API 호출 함수 (Puppeteer page.evaluate 사용)
 * @param {object} page - Puppeteer Page 인스턴스
 * @param {string} method - HTTP 메서드 (GET, POST 등)
 * @param {string} url - 호출할 API URL
 * @param {object} [options] - 추가 옵션 (data, headers 등)
 * @returns {Promise<any>} - API 응답 데이터
 */
async function api(page, method, url, options = {}) {
    const defaultHeaders = {
        'Content-Type': 'application/json; charset=utf-8',
    }

    log(`[API] current url: ${page.url()}`);
    log(`[API] request headers: ${JSON.stringify(options.headers || {})}`);

    // 상대 경로인 경우 현재 페이지 주소를 기준으로 절대 경로로 변환
    if (!url.includes('https://') && !url.includes('http://')) {
        const fullUrl = page.url();
        const { origin } = new URL(fullUrl);
        url = origin + url;
    }

    log(`[API] current cookies: ${JSON.stringify(await page.cookies())}`);
    const cookies = await page.cookies();

    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    if (method === 'GET') {
        url = url + toQueryString(options.data);
    }

    log(`[API] request url: ${url}`);
    log(`[API] params: ${JSON.stringify(options.data)}`);

    const { data, headers } = options;
    const requestOptions = {
        method,
        credentials: 'include',
        headers: { ...defaultHeaders, ...headers, 'Cookie': cookieHeader },
    };

    // POST, PUT 등의 경우 body 추가
    if (method !== 'GET' && data) {
        requestOptions.body = typeof data === 'string' ? data : JSON.stringify(data);
    }

    const res = await fetch(url, requestOptions);
    log(`[API] response status: ${res.status}`);

    const response = await res.json().catch(() => res.text());
    log(`[API] response data: ${JSON.stringify(response)}`);

    // const response = await page.evaluate(async (url, requestOptions) => {
    //     try {
    //         const response = await fetch(url, requestOptions);
    //         const contentType = response.headers.get('content-type') || '';
            
    //         if (contentType.includes('application/json')) {
    //             return await response.json();
    //         } else {
    //             return await response.text();
    //         }
    //     } catch (error) {
    //         throw new Error(`API 호출 실패: ${error.message}`);
    //     }
    // }, url, requestOptions);

    return response;
}

/**
 * fetchFunctions 설정
 * @param {string} service - 서비스명 ('baemin' 또는 'coupang')
 * @param {object} functions - fetch 함수들
 */
function setFetchFunctions(service, functions) {
    fetchFunctions[service] = functions;
}

/**
 * 캐시된 데이터 반환
 * @param {object} page - Puppeteer Page 인스턴스
 * @param {string} service - 서비스명 ('baemin' 또는 'coupang')
 * @param {string} cacheKey - 캐시 키
 * @param {object} params - 파라미터
 * @returns {Promise<any>} - 캐시된 데이터
 */
async function getCachedData(page, service, cacheKey, params) {
    const now = Date.now();
    const cacheItem = cache[service][cacheKey];

    const fetchFunction = fetchFunctions[service][cacheKey];

    if (cacheItem.data && cacheItem.timestamp && (now - cacheItem.timestamp < CACHE_DURATION)) {
        log(`Using cached ${service}.${cacheKey}`);
        return cacheItem.data;
    }
    
    log(`Fetching fresh ${service}.${cacheKey}`);
    cacheItem.data = await fetchFunction(page, params);
    cacheItem.timestamp = now;
    
    return cacheItem.data;
}

/**
 * 캐시 초기화
 * @param {string} service - 서비스명 ('baemin' 또는 'coupang'), 생략시 모든 서비스
 */
async function initCache(service = null) {
    if (service) {
        cache[service] = {
            shopInfo: { data: null, timestamp: null },
            menuList: { data: null, timestamp: null },
        };
    } else {
        cache = {
            baemin: {
                shopInfo: { data: null, timestamp: null },
                menuList: { data: null, timestamp: null },
            },
            coupang: {
                shopInfo: { data: null, timestamp: null },
                menuList: { data: null, timestamp: null },
            },
        };
    }
}

/**
 * context에 쿠키 세팅
 * @param {object} context - Puppeteer BrowserContext 인스턴스
 * @param {string} service - 서비스명 ('baemin' 또는 'coupang')
 * @returns {Promise<boolean>} - 쿠키 설정 성공 여부
 */
async function setCookiesIfExists(context, service) {
    try {
        const cookiesJson = await fs.readFile(COOKIE_PATHS[service], 'utf-8');
        const cookies = JSON.parse(cookiesJson);
        const page = await context.newPage();
        await page.setCookie(...cookies);
        await page.close();
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * context의 쿠키 저장
 * @param {object} context - Puppeteer BrowserContext 인스턴스
 * @param {string} service - 서비스명 ('baemin' 또는 'coupang')
 */
async function saveCookies(context, service) {
    try {
        const page = await context.newPage();
        const cookies = await page.cookies();
        await page.close();
        await fs.writeFile(COOKIE_PATHS[service], JSON.stringify(cookies, null, 2));
        log(`Cookies saved for ${service}`);
    } catch (e) {
        console.error(`Failed to save cookies for ${service}:`, e);
    }
}

/**
 * 캐시 유효성 검사
 * @param {string} service - 서비스명 ('baemin' 또는 'coupang')
 * @param {string} cacheKey - 캐시 키
 * @returns {boolean} - 캐시 유효성
 */
function isCacheValid(service, cacheKey) {
    const now = Date.now();
    const cacheItem = cache[service][cacheKey];
    return cacheItem.data && cacheItem.timestamp && (now - cacheItem.timestamp < CACHE_DURATION);
}

/**
 * 모든 캐시 유효성 검사
 * @param {string} service - 서비스명 ('baemin' 또는 'coupang')
 * @param {Array<string>} cacheKeys - 검사할 캐시 키들
 * @returns {boolean} - 모든 캐시 유효성
 */
function areAllCachesValid(service, cacheKeys) {
    return cacheKeys.every(key => isCacheValid(service, key));
}

const log = (message) => {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    let controller = 'unknown';

    // Use stack trace to get the caller file name for better reliability
    try {
        const stack = new Error().stack;
        if (stack) {
            const stackLines = stack.split('\n');
            // Find the first stack line outside this file
            const callerLine = stackLines.find(line => !line.includes(__filename) && line.includes('.js'));
            if (callerLine) {
                const match = callerLine.match(/([\/\\][^\/\\]+\.js)/);
                if (match && match[1]) {
                    controller = match[1].replace('.js', '').replace(/[\/\\]/g, '');
                }
            }
        }
    } catch (e) {
        // fallback to unknown
    }

    console.log(`[${timestamp}] [${controller}] ${message}`);
}

module.exports = {
    CACHE_DURATION,
    cache,
    toQueryString,
    goto,
    api,
    setFetchFunctions,
    getCachedData,
    initCache,
    setCookiesIfExists,
    saveCookies,
    isCacheValid,
    areAllCachesValid,
    log,
};
