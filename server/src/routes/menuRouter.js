const express = require('express');
const router = express.Router();
const { getCachedData, setFetchFunctions, initCache, getCacheData, isCacheValid } = require('../utils/cache');
const BaeminService  = require('../services/BaeminService');
const CoupangService = require('../services/CoupangService');
const DdangyoService = require('../services/DdangyoService');
const YogiyoService  = require('../services/YogiyoService');
const { executeAllWithLogin } = require('../services/CommonService');
const { log } = require('../utils/logger');

// 서비스별 캐시 fetch 함수 등록
setFetchFunctions('baemin',  { shopInfo: BaeminService.getShopInfo,  menuList: BaeminService.getAllMenuList  });
setFetchFunctions('coupang', { shopInfo: CoupangService.getShopInfo, menuList: CoupangService.getAllMenuList });
setFetchFunctions('ddangyo', { shopInfo: DdangyoService.getShopInfo, menuList: DdangyoService.getAllMenuList });
setFetchFunctions('yogiyo',  { shopInfo: YogiyoService.getShopInfo,  menuList: YogiyoService.getAllMenuList  });

const SERVICES = ['baemin', 'coupang', 'ddangyo', 'yogiyo'];

// loginMiddleware 제거 - route handler에서 직접 캐시 확인 및 login 처리

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
 *
 * 프로세스: 캐시 확인 → (캐시 미스 시 login) → API 호출 → 반환
 */
router.post('/shop-info', async (req, res, next) => {
  try {
    const services = req.body.services || SERVICES;
    const { serviceContexts } = req;

    // 캐시된 서비스와 아닌 서비스 분리
    const cachedServices = [];
    const nonCachedServices = [];

    for (const service of services) {
      if (isCacheValid(service, 'shopInfo') && isCacheValid(service, 'menuList')) {
        cachedServices.push(service);
      } else {
        nonCachedServices.push(service);
      }
    }

    // 결과 객체 생성
    const results = {};

    // 캐시된 서비스는 바로 결과에 추가 (login 불필요)
    // 데이터 구조: { service: { success: true, data: { shopInfo, menuList } } }
    for (const service of cachedServices) {
      const shopInfo = getCacheData(service, 'shopInfo');
      const menuList = getCacheData(service, 'menuList');
      results[service] = { success: true, data: { shopInfo, menuList } };
      log(`[${service}] Using cached data - no login needed`);
    }

    // 캐시되지 않은 서비스만 login 후 데이터 가져오기
    if (nonCachedServices.length > 0) {
      const freshResults = await executeAllWithLogin(nonCachedServices, async (service, page) => {
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

      // 결과 병합 (이미 { success, data } 구조)
      for (const [service, result] of Object.entries(freshResults)) {
        results[service] = result;
      }
    }

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