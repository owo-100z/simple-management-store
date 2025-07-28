const express = require('express');
const router = express.Router();
const coupangService = require('./CoupangService');
const common = require('./common');
const wrapAsyncRoutes = require('./wrapAsyncRoutes');

const service = 'coupang';

// fetchFunctions 설정 (쿠팡 서비스)
common.setFetchFunctions(service, {
    shopInfo: coupangService.getShopInfo,
    menuList: coupangService.getAllMenuList,
});

// 캐시 체크가 필요한 라우트들
const CACHE_ROUTES = ['/get-shop-info'];

// 캐시 초기화 (interceptor 거치지 않음)
router.get('/initCache', async (req, res) => {
  await common.initCache(service);
  res.json({ success: true, data: 'Coupang cache initialized' });
});

// interceptor
router.use(async (req, res, next) => {
  const { username, password } = { username: process.env.CP_ID, password: process.env.CP_PW };
  const context = req.context;
  const page = req.page;

  // 캐시 체크가 필요한 라우트인지 확인
  const isCacheRoute = CACHE_ROUTES.includes(req.path);
  
  if (isCacheRoute) {
    // 캐시 체크 후 진행 (쿠팡 서비스)
    const cacheKeys = ['shopInfo', 'menuList'];
    if (common.areAllCachesValid(service, cacheKeys)) {
      common.log('Cache exists, skipping login');
      next();
      return;
    }
  }

  // 캐시가 없거나 로그인 필수 라우트면 로그인 진행
  common.log('Login required, proceeding with login');
  let loggedIn = false;
  
  if (await common.setCookiesIfExists(context, service)) {
    await common.goto(page, process.env.CP_URL);
    //await page.goto(process.env.CP_URL);
    const currentUrl = page.url();
    common.log(`Current URL: ${currentUrl}`);
    if (currentUrl.includes('/home')) {
      loggedIn = true;
    }
  }

  common.log(`Logged in status: ${loggedIn}`);

  if (!loggedIn) {
    const result = await coupangService.login(page, username, password);
    if (!result.success) {
      return res.status(401).json({ success: false, error: 'Login failed' });
    }
    await common.saveCookies(context, service);
  }

  next();
});

/**
 * 상점 정보 조회
 * @param {object} req - 요청 객체
 * @param {object} res - 응답 객체
 * @returns {Promise<void>} - 상점 정보 조회 결과
 */
router.get('/get-shop-info', async (req, res) => {
  const page = req.page;
  const shopInfo = await common.getCachedData(page, service, 'shopInfo');

  const params = { shopId: shopInfo.id, shopOwnerId: shopInfo.shopOwnerId };
  const menuList = await common.getCachedData(page, service, 'menuList', params);

  const response = { shopInfo, menuList };

  //common.log(response);
  res.json({ success: true, data: response });
});

/**
 * 메뉴 및 옵션 품절
 * @param {object} req - 요청 객체
 * @param {object} res - 응답 객체
 * @returns {Promise<void>} - 메뉴 및 옵션 품절 결과
 */
router.post('/soldout', async (req, res) => {
  const page = req.page;
  const shopInfo = await common.getCachedData(page, service, 'shopInfo');
  const params = { 
    shopId: shopInfo.id,
    menuIds: req.body.menuList,
    optionIds: req.body.optionList
  };
  // common.log(`soldout params: ${JSON.stringify(params)}`);
  // res.json({ success: true, data: {message: 'test'} });
  const soldoutResponse = await coupangService.soldout(page, params);
  res.json({ success: soldoutResponse.success, data: soldoutResponse });
});

/**
 * 메뉴 및 옵션 활성화
 * @param {object} req - 요청 객체
 * @param {object} res - 응답 객체
 * @returns {Promise<void>} - 메뉴 및 옵션 활성화 결과
 */
router.post('/active', async (req, res) => {
  const page = req.page;
  const shopInfo = await common.getCachedData(page, service, 'shopInfo');
  const params = { 
    shopId: shopInfo.id,
    menuIds: req.body.menuList,
    optionIds: req.body.optionList
  };
  // common.log(`active params: ${JSON.stringify(params)}`);
  // res.json({ success: true, data: {message: 'test'} });
  const activeResponse = await coupangService.active(page, params);
  res.json({ success: activeResponse.success, data: activeResponse });
});

/**
 * 임시휴무일 설정
 * @param {object} req - 요청 객체
 * @param {object} res - 응답 객체
 * @returns {Promise<void>} - 임시휴무일 설정 결과
 */
router.post('/temporary-stop', async (req, res) => {
  const page = req.page;
  const shopInfo = await common.getCachedData(page, service, 'shopInfo');
  const params = {
    shopId: shopInfo.id,
    from: req.body.from,
    to: req.body.to
  };
  const temporaryStopResponse = await coupangService.irregularHolidays(page, params);
  res.json({ success: temporaryStopResponse.code === 'SUCCESS', data: temporaryStopResponse });
});

/**
 * 임시휴무일 해제
 * @param {object} req - 요청 객체
 * @param {object} res - 응답 객체
 * @returns {Promise<void>} - 임시휴무일 해제 결과
 */
router.post('/release-stop', async (req, res) => {
  const page = req.page;
  const shopInfo = await common.getCachedData(page, service, 'shopInfo');
  const params = { 
    shopId: shopInfo.id,
  };
  const releaseStopResponse = await coupangService.irregularHolidays(page, params);
  res.json({ success: releaseStopResponse.code === 'SUCCESS', data: releaseStopResponse });
});

module.exports = wrapAsyncRoutes(router);