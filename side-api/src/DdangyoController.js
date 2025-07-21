const express = require('express');
const router = express.Router();
const ddangyoService = require('./DdangyoService');
const common = require('./common');

const service = 'ddangyo';

// fetchFunctions 설정 (땡겨요 서비스)
common.setFetchFunctions(service, {
    shopInfo: ddangyoService.getShopInfo,
    menuList: ddangyoService.getAllMenuList,
});

// 캐시 체크가 필요한 라우트들
const CACHE_ROUTES = ['/get-shop-info'];

// 캐시 초기화 (interceptor 거치지 않음)
router.get('/initCache', async (req, res) => {
  await common.initCache(service);
  res.json({ success: true, data: 'Ddangyo cache initialized' });
});

// interceptor
router.use(async (req, res, next) => {
  const { username, password } = { username: process.env.DG_ID, password: process.env.DG_PW };
  const context = req.context;
  const page = req.page;

  // 캐시 체크가 필요한 라우트인지 확인
  const isCacheRoute = CACHE_ROUTES.includes(req.path);
  
  if (isCacheRoute) {
    // 캐시 체크 후 진행 (땡겨요 서비스)
    const cacheKeys = ['shopInfo', 'menuList'];
    if (common.areAllCachesValid(service, cacheKeys)) {
      console.log('Cache exists, skipping login');
      next();
      return;
    }
  }

  // 캐시가 없거나 로그인 필수 라우트면 로그인 진행
  console.log('Login required, proceeding with login');
  let loggedIn = false;
  
  await common.goto(page, process.env.DG_URL);
  //await page.goto(process.env.DG_URL);

  if (await common.setCookiesIfExists(context, service)) {
    loggedIn = await page.evaluate(() => {
      const inputID = document.querySelector('input[id="mf_ibx_mbrId"]');
      const inputPW = document.querySelector('input[id="mf_sct_pwd"]');

      if (inputID && inputPW) {
        inputID.value = '';
        inputPW.value = '';
        return false;
      } else {
        return true;
      }
    });
  }

  if (!loggedIn) {
    const result = await ddangyoService.login(page, username, password);
    if (!result.success) {
      return res.status(401).json({ success: false, error: 'Login failed' });
    }
    await common.saveCookies(context, service);
  }

  next();
});

router.get('/test', async (req, res) => {
  const page = req.page;
  const shopInfo = await ddangyoService.getShopInfo(page);
  res.json({ success: true, data: shopInfo });
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

  const params = { patstoNo: shopInfo.rpsnt_patsto_no };
  const menuList = await common.getCachedData(page, service, 'menuList', params);

  const response = { shopInfo, menuList };

  //console.log(response);
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
  
    const params = { patstoNo: shopInfo.rpsnt_patsto_no, menuName: req.query.menuName };
    const menuList = await ddangyoService.getMenuList(page, params);
  
    //console.log(menuList);
  
    //console.log(menuList.data.content);
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
  
    const params = { patstoNo: shopInfo.rpsnt_patsto_no, optionName: req.query.optionName };
    const optionList = await ddangyoService.getOptionList(page, params);
  
    //console.log(optionList);
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
    patstoNo: shopInfo.rpsnt_patsto_no,
    patstoMbrId: shopInfo.patsto_mbr_id,
    menuList: req.body.menuList,
    optionList: req.body.optionList
  };
  // console.log(`soldout params: ${JSON.stringify(params)}`);
  // res.json({ success: true, data: {message: 'test'} });
  const soldoutResponse = await ddangyoService.soldout(page, params);
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
    patstoNo: shopInfo.rpsnt_patsto_no,
    patstoMbrId: shopInfo.patsto_mbr_id,
    menuList: req.body.menuList,
    optionList: req.body.optionList
  };
  // console.log(`active params: ${JSON.stringify(params)}`);
  // res.json({ success: true, data: {message: 'test'} });
  const activeResponse = await ddangyoService.active(page, params);
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
    patstoNo: shopInfo.rpsnt_patsto_no,
    finChgId: shopInfo.patsto_mbr_id,
    to: req.body.to, // 'YYYYMMDDHHmmSS' 형식
  };
  const temporaryStopResponse = await ddangyoService.temporaryStop(page, params);
  res.json({ success: temporaryStopResponse.dma_error.result === 'SUCCESS', data: temporaryStopResponse });
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
    patstoNo: shopInfo.rpsnt_patsto_no,
    finChgId: shopInfo.patsto_mbr_id
  };
  const releaseStopResponse = await ddangyoService.temporaryStop(page, params);
  res.json({ success: releaseStopResponse.dma_error.result === 'SUCCESS', data: releaseStopResponse });
});

module.exports = router; 