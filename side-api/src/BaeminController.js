const express = require('express');
const router = express.Router();
const baeminService = require('./BaeminService');
const common = require('./common');
const wrapAsyncRoutes = require('./wrapAsyncRoutes');

const service = 'baemin';

// fetchFunctions 설정 (배민 서비스)
common.setFetchFunctions(service, {
    shopInfo: baeminService.getShopInfo,
    menuList: baeminService.getAllMenuList,
});

// 캐시 체크가 필요한 라우트들
const CACHE_ROUTES = ['/get-shop-info'];

// 캐시 초기화 (interceptor 거치지 않음)
router.get('/initCache', async (req, res) => {
  await common.initCache(service);
  res.json({ success: true, data: 'Baemin cache initialized' });
});

// interceptor
router.use(async (req, res, next) => {
  const { username, password } = { username: process.env.BM_ID, password: process.env.BM_PW };
  const context = req.context;
  const page = req.page;

  // 캐시 체크가 필요한 라우트인지 확인
  const isCacheRoute = CACHE_ROUTES.includes(req.path);
  
  if (isCacheRoute) {
    // 캐시 체크 후 진행 (배민 서비스)
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
    await common.goto(page, process.env.BM_URL);
    //await page.goto(process.env.BM_URL);
    const currentUrl = page.url();
    if (currentUrl.includes(process.env.BM_URL)) {
      loggedIn = true;
    }
  }

  if (!loggedIn) {
    const result = await baeminService.login(page, username, password);
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

  if (!shopInfo) {
    return res.status(404).json({ success: false, error: 'Shop information not found' });
  }

  const params = { shopNo: shopInfo.shopNo, shopOwnerNumber: shopInfo.shopOwnerNumber };
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

  const params = { shopNo: shopInfo.shopNo, shopOwnerNumber: shopInfo.shopOwnerNumber, menuName: req.query.menuName, page: req.query.page };
  const menuList = await baeminService.getMenuList(page, params);

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

  const params = { shopNo: shopInfo.shopNo, shopOwnerNumber: shopInfo.shopOwnerNumber, optionName: req.query.optionName, page: req.query.page };
  const optionList = await baeminService.getOptionList(page, params);

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
    shopNo: shopInfo.shopNo,
    shopOwnerNumber: shopInfo.shopOwnerNumber,
    menuIds: req.body.menuList,
    optionIds: req.body.optionList,
    restockedAt: req.body.restockedAt
  };
  // common.log(`soldout params: ${JSON.stringify(params)}`);
  // res.json({ success: true, data: {message: 'test'} });
  const soldoutResponse = await baeminService.soldout(page, params);
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
    shopNo: shopInfo.shopNo,
    shopOwnerNumber: shopInfo.shopOwnerNumber,
    menuIds: req.body.menuList,
    optionIds: req.body.optionList
  };
  // common.log(`active params: ${JSON.stringify(params)}`);
  // res.json({ success: true, data: {message: 'test'} });
  const activeResponse = await baeminService.active(page, params);
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
  const params = {
    from: req.body.from,
    to: req.body.to
  };
  const temporaryStopResponse = await baeminService.temporaryStop(page, params);
  res.json({ success: !temporaryStopResponse.errorType, data: temporaryStopResponse });
});

/**
 * 임시중지 해제
 * @param {object} req - 요청 객체
 * @param {object} res - 응답 객체
 * @returns {Promise<void>} - 임시중지 해제 결과
 */
router.post('/release-stop', async (req, res) => {
  const page = req.page;
  const releaseStopResponse = await baeminService.releaseStop(page);
  res.json({ success: !releaseStopResponse.errorType, data: releaseStopResponse });
});

module.exports = wrapAsyncRoutes(router);