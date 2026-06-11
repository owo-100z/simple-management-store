const { log, error } = require('../utils/logger');
const BaeminService  = require('../services/BaeminService');
const CoupangService = require('../services/CoupangService');
const DdangyoService = require('../services/DdangyoService');
const YogiyoService  = require('../services/YogiyoService');
const { goto } = require('../utils/browser');

const SERVICES = ['baemin', 'coupang', 'ddangyo', 'yogiyo'];

// 서비스별 로그인 함수
const LOGIN_FUNCTIONS = {
  baemin:  (page) => BaeminService.login(page, process.env.BAEMIN_ID, process.env.BAEMIN_PW),
  coupang: (page) => CoupangService.login(page, process.env.COUPANG_ID, process.env.COUPANG_PW),
  ddangyo: (page) => DdangyoService.login(page, process.env.DDANGYO_ID, process.env.DDANGYO_PW),
  yogiyo:  (page) => YogiyoService.login(page, process.env.YOGIYO_ID, process.env.YOGIYO_PW),
};

// 서비스별 로그인 상태 확인
const CHECK_LOGIN_FUNCTIONS = {
  baemin: async (page) => {
    try {
      await goto(page, process.env.BAEMIN_URL, 10000, 'networkidle2');
      return page.url().includes(process.env.BAEMIN_URL);
    } catch { return false; }
  },
  coupang: async (page) => {
    try {
      await goto(page, process.env.COUPANG_URL, 10000, 'networkidle2');
      return page.url().includes('/merchant/management/home');
    } catch { return false; }
  },
  ddangyo: async (page) => {
    try {
      await goto(page, process.env.DDANGYO_URL, 10000, 'networkidle2');
      const isLoginPage = await page.evaluate(() => !!document.querySelector('input[id="mf_ibx_mbrId"]'));
      return !isLoginPage;
    } catch { return false; }
  },
  yogiyo: async (page) => {
    try {
      await goto(page, process.env.YOGIYO_URL, 10000, 'networkidle2');
      return page.url().includes(process.env.YOGIYO_URL);
    } catch { return false; }
  },
};

/**
 * 여러 서비스 동시 실행 후 결과 통합
 *
 * @param {string[]} services - 실행할 서비스 목록
 * @param {Function} callback - async (service, page) => result
 * @param {object} serviceContexts - req.serviceContexts
 * @returns {object} - { baemin: { success, data }, coupang: { success, error }, ... }
 */
async function executeAll(services, callback, serviceContexts) {
  // 유효한 서비스만 필터
  const validServices = services.filter((s) => SERVICES.includes(s));

  if (!validServices.length) {
    throw new Error('유효한 서비스가 없습니다.');
  }

  // 동시 실행
  const results = await Promise.allSettled(
    validServices.map(async (service) => {
      const ctx = serviceContexts[service];
      if (!ctx?.page) throw new Error(`${service} 컨텍스트 없음`);

      log(`[${service}] executeAll 시작`);
      const result = await callback(service, ctx.page);
      log(`[${service}] executeAll 완료`);
      return result;
    })
  );

  // 결과 통합
  return validServices.reduce((acc, service, index) => {
    const result = results[index];
    if (result.status === 'fulfilled') {
      acc[service] = { success: true, data: result.value };
    } else {
      error(`[${service}] executeAll 실패: ${result.reason?.message}`);
      acc[service] = { success: false, error: result.reason?.message };
    }
    return acc;
  }, {});
}

/**
 * login 후 여러 서비스 동시 실행
 * - loginMiddleware 없이 login을 직접 수행
 *
 * @param {string[]} services - 실행할 서비스 목록
 * @param {Function} callback - async (service, page) => result
 * @param {object} serviceContexts - req.serviceContexts
 * @returns {object} - { baemin: { success, data }, coupang: { success, error }, ... }
 */
async function executeAllWithLogin(services, callback, serviceContexts) {
  const validServices = services.filter((s) => SERVICES.includes(s));

  if (!validServices.length) {
    throw new Error('유효한 서비스가 없습니다.');
  }

  // 동시 실행 (각 서비스마다 login 후 callback 실행)
  const results = await Promise.allSettled(
    validServices.map(async (service) => {
      const ctx = serviceContexts[service];
      if (!ctx?.page) throw new Error(`${service} 컨텍스트 없음`);

      const page = ctx.page;

      // login 상태 확인
      log(`[${service}] Checking login status`);
      const loggedIn = await CHECK_LOGIN_FUNCTIONS[service](page);

      if (!loggedIn) {
        // login 필요
        log(`[${service}] Login required - proceeding`);
        const loginResult = await LOGIN_FUNCTIONS[service](page);
        
        if (!loginResult.success) {
          throw new Error(`${service} login failed: ${loginResult.error}`);
        }
        
        log(`[${service}] Login success`);
        // 쿠키 저장
        if (ctx.saveCookies) {
          await ctx.saveCookies(service, page);
        }
      } else {
        log(`[${service}] Already logged in`);
      }

      // 데이터 가져오기
      log(`[${service}] executeAllWithLogin 시작`);
      const result = await callback(service, page);
      log(`[${service}] executeAllWithLogin 완료`);
      return result;
    })
  );

  // 결과 통합
  return validServices.reduce((acc, service, index) => {
    const result = results[index];
    if (result.status === 'fulfilled') {
      acc[service] = { success: true, data: result.value };
    } else {
      error(`[${service}] executeAllWithLogin 실패: ${result.reason?.message}`);
      acc[service] = { success: false, error: result.reason?.message };
    }
    return acc;
  }, {});
}

module.exports = { executeAll, executeAllWithLogin };