const { goto } = require('../utils/browser');
const { log, error } = require('../utils/logger');
const { areAllCachesValid, getCacheData } = require('../utils/cache');

const BaeminService  = require('../services/BaeminService');
const CoupangService = require('../services/CoupangService');
const DdangyoService = require('../services/DdangyoService');
const YogiyoService  = require('../services/YogiyoService');

// 서비스별 로그인 설정
const SERVICE_CONFIG = {
  baemin: {
    loginFn:    (page) => BaeminService.login(page, process.env.BAEMIN_ID, process.env.BAEMIN_PW),
    checkLogin: async (page) => {
      try {
        await goto(page, process.env.BAEMIN_URL, 15000, 'networkidle2');
        return page.url().includes(process.env.BAEMIN_URL);
      } catch {
        return false;
      }
    },
  },
  coupang: {
    loginFn:    (page) => CoupangService.login(page, process.env.COUPANG_ID, process.env.COUPANG_PW),
    checkLogin: async (page) => {
      try {
        await goto(page, process.env.COUPANG_URL, 10000, 'networkidle2');
        return page.url().includes('/merchant/management/home');
      } catch {
        return false;
      }
    },
  },
  ddangyo: {
    loginFn:    (page) => DdangyoService.login(page, process.env.DDANGYO_ID, process.env.DDANGYO_PW),
    checkLogin: async (page) => {
      try {
        await goto(page, process.env.DDANGYO_URL, 10000, 'networkidle2');
        // 로그인 input이 없으면 로그인된 상태
        const isLoginPage = await page.evaluate(() => {
          return !!document.querySelector('input[id="mf_ibx_mbrId"]');
        });
        return !isLoginPage;
      } catch {
        return false;
      }
    },
  },
  yogiyo: {
    loginFn:    (page) => YogiyoService.login(page, process.env.YOGIYO_ID, process.env.YOGIYO_PW),
    checkLogin: async (page) => {
      try {
        await goto(page, process.env.YOGIYO_URL, 10000, 'networkidle2');
        return page.url().includes(process.env.YOGIYO_URL);
      } catch {
        return false;
      }
    },
  },
};

// 캐시 체크가 필요한 라우트
const CACHE_ROUTES = ['/menu/shop-info', '/menu/menu-list'];

/**
 * 서비스별 로그인 미들웨어 생성 팩토리
 * @param {string} service - 서비스명
 */
function createLoginMiddleware(service) {
  return async function loginMiddleware(req, res, next) {
    const config = SERVICE_CONFIG[service];
    if (!config) return next(new Error(`Unknown service: ${service}`));

    const page = req.serviceContexts[service]?.page;
    if (!page) return next(new Error(`No page context for service: ${service}`));

    try {
      // 캐시 유효한 라우트면 로그인 체크 스킵
      if (CACHE_ROUTES.includes(req.path)) {
        if (areAllCachesValid(service, ['shopInfo', 'menuList'])) {
          log(`[${service}] CACHE HIT - ${req.path} - login check skipped`);
          return next();
        } else {
          log(`[${service}] CACHE MISS - ${req.path} - login required`);
        }
      }

      // 로그인 상태 확인
      log(`[${service}] Checking login status`);
      const loggedIn = await config.checkLogin(page);

      if (loggedIn) {
        log(`[${service}] Already logged in`);
        await req.saveCookies(service, page);
        return next();
      }

      // 로그인 필요
      log(`[${service}] Login required - proceeding`);
      const result = await config.loginFn(page);

      if (!result.success) {
        error(`[${service}] Login failed: ${result.error}`);
        return res.status(401).json({ success: false, error: `${service} 로그인 실패` });
      }

      log(`[${service}] Login success`);
      await req.saveCookies(service, page);
      next();

    } catch (e) {
      error(`[${service}] Login middleware error: ${e.message}`);
      next(e);
    }
  };
}

module.exports = { createLoginMiddleware };