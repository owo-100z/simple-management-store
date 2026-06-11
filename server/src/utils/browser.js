const { log, error } = require('./logger');

/**
 * 객체를 쿼리스트링으로 변환
 */
function toQueryString(params) {
  if (!params) return '';
  const qs = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return qs ? `?${qs}` : '';
}

/**
 * 페이지 이동
 */
async function goto(page, url, timeout = 15000, waitUntil = 'domcontentloaded') {
  log(`[goto] ${url}`);
  try {
    return await page.goto(url, { waitUntil, timeout });
  } catch (e) {
    error(`[goto] failed: ${e.message}`);
    throw e;
  }
}

/**
 * 공통 API 호출 (page.evaluate 기반 - 브라우저 컨텍스트에서 fetch 실행)
 * 브라우저 세션/쿠키가 자동으로 포함됨
 */
async function api(page, method, url, options = {}) {
  const fullUrl = page.url();
  const { origin } = new URL(fullUrl);

  // 상대경로면 현재 페이지 origin 기준으로 절대경로 변환
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = origin + url;
  }

  // GET이면 쿼리스트링으로
  if (method === 'GET') {
    url = url + toQueryString(options.data);
  }

  // log(`#### 현재 페이지 ==> ${origin}`);
  // log(`$$$ Cookies => ${JSON.stringify(await page.cookies())}`);
  log(`[API] ${method} ${url}`);
  if (options.data) log(`[API] params: ${JSON.stringify(options.data)}`);

  const { data, headers = {} } = options;

  const result = await page.evaluate(
    async (method, url, data, headers, origin, referer) => {
      const requestOptions = {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Origin': origin,
          'Referer': referer,
          ...headers,
        },
      };

      if (method !== 'GET' && data) {
        requestOptions.body = typeof data === 'string' ? data : JSON.stringify(data);
      }

      const res = await fetch(url, requestOptions);
      const text = await res.text();

      const responseHeaders = {};
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      return { status: res.status, text, responseHeaders, requestOptions };
    },
    method,
    url,
    data,
    headers,
    origin,
    fullUrl
  );

  // log(`[API] response status: ${result.status}`);

  // if (result.status !== 200) {
  //   log(`response headers ===> ${JSON.stringify(result.responseHeaders)}`)
  //   log(`request header ===> ${JSON.stringify(result.requestOptions)}`);
  // }

  try {
    const response = JSON.parse(result.text);

    const jsonStr = JSON.stringify(response);
    log(`[API] [request: ${url}] response: ${jsonStr.substring(0, 50)}`); // 최대 50자 까지만 노출
    return response;
  } catch {
    log(`[API] Non-JSON response (status: ${result.status})`);
    return null;
  }
}

module.exports = { toQueryString, goto, api, fillInputs };

/**
 * input에 값 채우기 (React/Vue 프레임워크 대응)
 * page.type 대신 사용 - 기존 값 덮어쓰기 가능
 *
 * @param {object} page - Puppeteer Page 인스턴스
 * @param {Array<{selector: string, value: string}>} fields - 채울 필드 목록
 */
async function fillInputs(page, fields) {
  await page.evaluate((fields) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set;

    fields.forEach(({ selector, value }) => {
      const input = document.querySelector(selector);
      if (!input) return;

      nativeInputValueSetter.call(input, value);
      input.dispatchEvent(new Event('input',  { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }, fields);
}
module.exports = { toQueryString, goto, api, fillInputs };