const express = require('express');
const router = express.Router();
const { createLoginMiddleware } = require('../middleware/loginMiddleware');
const { getCacheData, getCachedData, setFetchFunctions, initCache } = require('../utils/cache');
const BaeminService  = require('../services/BaeminService');
const CoupangService = require('../services/CoupangService');
const DdangyoService = require('../services/DdangyoService');
const YogiyoService  = require('../services/YogiyoService');
const { executeAll } = require('../services/CommonService');
const { log } = require('../utils/logger');

// 서비스별 캐시 fetch 함수 등록
setFetchFunctions('baemin',  { shopInfo: BaeminService.getShopInfo,  menuList: BaeminService.getAllMenuList  });
setFetchFunctions('coupang', { shopInfo: CoupangService.getShopInfo, menuList: CoupangService.getAllMenuList });
setFetchFunctions('ddangyo', { shopInfo: DdangyoService.getShopInfo, menuList: DdangyoService.getAllMenuList });
setFetchFunctions('yogiyo',  { shopInfo: YogiyoService.getShopInfo,  menuList: YogiyoService.getAllMenuList  });

const SERVICES = ['baemin', 'coupang', 'ddangyo', 'yogiyo'];

// 1. 각 서비스별로 라우터를 등록합니다.
SERVICES.forEach((service) => {
  
  // 요청이 들어올 때마다 실행되는 '동적 미들웨어'를 만듭니다.
  router.use((req, res, next) => {
    // [핵심] 요청 시점에 캐시 데이터를 매번 확인합니다.
    const shopInfo = getCacheData(service, 'shopInfo');
    const menuList = getCacheData(service, 'menuList');

    // log(`[${service}] Request time check - shopInfo: ${!!shopInfo}, menuList: ${!!menuList}`);

    if (!shopInfo || !menuList) {
      // 캐시가 없으면 로그인 미들웨어를 실행합니다.
      // createLoginMiddleware(service)가 반환하는 함수에 (req, res, next)를 넘겨 직접 호출합니다.
      const loginMiddleware = createLoginMiddleware(service);
      return loginMiddleware(req, res, next);
    }

    // 캐시가 있다면 로그인을 건너뛰고 다음 미들웨어/컨트롤러로 이동합니다.
    next();
  });
});

/**
 * 캐시 초기화
 * GET /api/menu/init-cache?service=baemin
 */
router.get('/init-cache', async (req, res) => {
  const { service } = req.query;
  initCache(service || null);
  res.json({ success: true, message: `${service || 'all'} cache cleared` });
});

/**
 * 서비스별 shopInfo 유효성 검사
 */
function isValidShopInfo(shopInfo, service) {
  if (!shopInfo) return false;
  if (shopInfo.success === false) return false;
  
  switch (service) {
    case 'baemin':
      return shopInfo.shopNo && shopInfo.shopOwnerNumber;
    case 'coupang':
      return shopInfo.storeId;
    case 'ddangyo':
      return shopInfo.rpsnt_patsto_no;
    case 'yogiyo':
      return shopInfo.id && shopInfo.company_number;
    default:
      return false;
  }
}

/**
 * 상점 정보 + 전체 메뉴 조회
 * POST /api/menu/shop-info
 * body: { services: ['baemin', 'coupang', ...] }
 */
router.post('/shop-info', async (req, res, next) => {
  try {
    const services = req.body.services || SERVICES;
    const { serviceContexts } = req;

    const results = await executeAll(services, async (service, page) => {
      const shopInfo = await getCachedData(page, service, 'shopInfo');

      // 가게 정보 유효성 검사
      if (!isValidShopInfo(shopInfo, service)) {
        log(`${service}: 가게정보 호출 오류, ${JSON.stringify(shopInfo)}`);
        return { shopInfo, menuList: null, error: `${service}: 유효한 가게 정보 없음` };
      }

      // 서비스별 shopInfo 파라미터 구조가 다름
      const menuParams = _getMenuParams(service, shopInfo);
      const menuList   = await getCachedData(page, service, 'menuList', menuParams);

      return { shopInfo, menuList };
    }, serviceContexts);

    res.json({ success: true, data: results });
  } catch (e) {
    next(e);
  }
});

/**
 * 서비스별 menuList 파라미터 생성
 */
function _getMenuParams(service, shopInfo) {
  switch (service) {
    case 'baemin':
      return { shopNo: shopInfo.shopNo, shopOwnerNumber: shopInfo.shopOwnerNumber };
    case 'coupang':
      return { shopId: shopInfo.storeId };
    case 'ddangyo':
      return { patstoNo: shopInfo.rpsnt_patsto_no };
    case 'yogiyo':
      return { shop_no: shopInfo.id, company_number: shopInfo.company_number };
    default:
      return {};
  }
}

module.exports = router;