const express = require('express');
const router = express.Router();
const yogiyoService = require('./YogiyoService');
const common = require('./common');
const wrapAsyncRoutes = require('./wrapAsyncRoutes');

const service = 'yogiyo';

// fetchFunctions 설정 (요기요 서비스)
common.setFetchFunctions(service, {
    shopInfo: yogiyoService.getShopInfo,
    menuList: yogiyoService.getAllMenuList,
});

// 캐시 체크가 필요한 라우트들
const CACHE_ROUTES = ['/get-shop-info'];

// 캐시 초기화 (interceptor 거치지 않음)
router.get('/initCache', async (req, res) => {
  await common.initCache(service);
  res.json({ success: true, data: 'Yogiyo cache initialized' });
});

// interceptor
router.use(async (req, res, next) => {
  const { username, password } = { username: process.env.YG_ID, password: process.env.YG_PW };
  const context = req.context;
  const page = req.page;

  // 캐시 체크가 필요한 라우트인지 확인
  const isCacheRoute = CACHE_ROUTES.includes(req.path);
  
  if (isCacheRoute) {
    // 캐시 체크 후 진행 (요기요 서비스)
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
    await common.goto(page, process.env.YG_URL);
    //await page.goto(process.env.YG_URL);
    const currentUrl = page.url();
    if (currentUrl.includes(process.env.YG_URL)) {
      loggedIn = true;
    }
  }

  if (!loggedIn) {
    const result = await yogiyoService.login(page, username, password);
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

  if (!shopInfo || !shopInfo.id) {
    return res.status(404).json({ success: false, error: 'Shop information not found' });
  }

  const params = { shop_no: shopInfo.id, company_number: shopInfo.company_number };
  const menuList = await common.getCachedData(page, service, 'menuList', params);

  const response = {shopInfo, menuList};

  //common.log(response);
  res.json({ success: true, data: response });
});

/**
 * 메뉴 조회
 * @param {object} req - 요청 객체
 * @param {object} res - 응답 객체
 * @returns {Promise<void>} - 메뉴 조회 결과
 */
router.get('/get-menu-list', async (req, res) => {
  const page = req.page;
  const shopInfo = await common.getCachedData(page, service, 'shopInfo');

  const size = req.size || 50;

  const params = { shop_no: shopInfo.id, company_number: shopInfo.company_number, size };
  const menuList = await yogiyoService.getMenuList(page, params);

  //common.log(menuList);

  //common.log(menuList.data.content);
  res.json({ success: true, data: menuList });
});

/**
 * 옵션 조회
 * @param {object} req - 요청 객체
 * @param {object} res - 응답 객체
 * @returns {Promise<void>} - 옵션 조회 결과
 */
router.get('/get-option-list', async (req, res) => {
  const page = req.page;
  const shopInfo = await common.getCachedData(page, service, 'shopInfo');

  const size = req.size || 50;

  const params = { shop_no: shopInfo.id, company_number: shopInfo.company_number, size };
  const optionList = await yogiyoService.getOptionList(page, params);

  //common.log(optionList);
  res.json({ success: true, data: optionList });
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
    shop_no: shopInfo.id,
    company_number: shopInfo.company_number,
    menuList: req.body.menuList,
    optionList: req.body.optionList
  };
  // common.log(`soldout params: ${JSON.stringify(params)}`);
  // res.json({ success: true, data: {message: 'test'} });
  const soldoutResponse = await yogiyoService.soldout(page, params);
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
    shop_no: shopInfo.id,
    company_number: shopInfo.company_number,
    menuList: req.body.menuList,
    optionList: req.body.optionList
  };
  // common.log(`active params: ${JSON.stringify(params)}`);
  // res.json({ success: true, data: {message: 'test'} });
  const activeResponse = await yogiyoService.active(page, params);
  res.json({ success: activeResponse.success, data: activeResponse });
});

/**
 * 임시중지
 * @param {object} req - 요청 객체
 * @param {object} res - 응답 객체
 * @returns {Promise<void>} - 임시중지 결과
 */
router.post('/temporary-stop', async (req, res) => {
  const page = req.page;
  const shopInfo = await common.getCachedData(page, service, 'shopInfo');
  const params = {
    shop_no: shopInfo.id,
    to: req.body.to
  };
  const temporaryStopResponse = await yogiyoService.temporaryStop(page, params);
  res.json({ success: temporaryStopResponse?.success, data: temporaryStopResponse?.message });
});

/**
 * 임시중지 해제
 * @param {object} req - 요청 객체
 * @param {object} res - 응답 객체
 * @returns {Promise<void>} - 임시중지 해제 결과
 */
router.post('/release-stop', async (req, res) => {
  const page = req.page;
  const shopInfo = await common.getCachedData(page, service, 'shopInfo');
  const params = {
    shop_no: shopInfo.id
  };
  const releaseStopResponse = await yogiyoService.releaseStop(page, params);
  res.json({ success: releaseStopResponse?.success, data: releaseStopResponse?.msg });
});

module.exports = wrapAsyncRoutes(router);