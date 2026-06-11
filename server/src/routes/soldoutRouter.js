const express = require('express');
const router = express.Router();
const { createLoginMiddleware } = require('../middleware/loginMiddleware');
const { getCachedData, getCacheData } = require('../utils/cache');
const BaeminService  = require('../services/BaeminService');
const CoupangService = require('../services/CoupangService');
const DdangyoService = require('../services/DdangyoService');
const YogiyoService  = require('../services/YogiyoService');
const { executeAll } = require('../services/CommonService');
const { log } = require('../utils/logger');

const SERVICES = ['baemin', 'coupang', 'ddangyo', 'yogiyo'];

// 선택된 서비스에 대해서만 로그인 미들웨어를 개별적으로 (순차) 적용
function createSelectiveLoginMiddleware(services) {
  return (req, res, next) => {
    const selectedServices = req.body.services || services;
    
    // 각 서비스의 로그인을 개별적으로 (순차) 처리
    const runLoginSequentially = async (index) => {
      if (index >= selectedServices.length) {
        return next();
      }
      
      const service = selectedServices[index];
      const middleware = createLoginMiddleware(service);
      
      await new Promise((resolve) => {
        middleware(req, res, (err) => {
          if (err) return next(err);
          resolve();
        });
      });
      
      // 다음 서비스 로그인으로 진행
      runLoginSequentially(index + 1);
    };
    
    runLoginSequentially(0);
  };
}

/**
 * 품절 처리
 * POST /api/soldout
 * body: {
 *   services: ['baemin', 'coupang', ...],
 *   menuList: { baemin: [...], coupang: [...] },
 *   optionList: { baemin: [...], coupang: [...] },
 *   restockedAt: '2026-06-30' (배민만 사용)
 * }
 */
router.post('/', createSelectiveLoginMiddleware(SERVICES), async (req, res, next) => {
  try {
    const { services = SERVICES, menuList, optionList, restockedAt } = req.body;

    const results = await executeAll(services, async (service, page) => {
      const shopInfo = await getCachedData(page, service, 'shopInfo');
      
      // 서비스별 ID 리스트를 전체 메뉴/옵션 객체로 변환
      const serviceMenuList = menuList?.[service] || [];
      const serviceOptionList = optionList?.[service] || [];
      const { menuList: fullMenuList, optionList: fullOptionList } =
        _convertIdsToObjects(service, serviceMenuList, serviceOptionList);
      
      const params = _buildParams(service, shopInfo, {
        menuList: fullMenuList,
        optionList: fullOptionList,
        restockedAt
      });

      switch (service) {
        case 'baemin':  return BaeminService.soldout(page, params);
        case 'coupang': return CoupangService.soldout(page, params);
        case 'ddangyo': return DdangyoService.soldout(page, params);
        case 'yogiyo':  return YogiyoService.soldout(page, params);
      }
    }, req.serviceContexts);

    res.json({ success: true, data: results });
  } catch (e) {
    next(e);
  }
});

/**
 * 품절 해제
 * POST /api/soldout/active
 */
router.post('/active', createSelectiveLoginMiddleware(SERVICES), async (req, res, next) => {
  try {
    const { services = SERVICES, menuList, optionList } = req.body;

    const results = await executeAll(services, async (service, page) => {
      const shopInfo = await getCachedData(page, service, 'shopInfo');
      
      // 서비스별 ID 리스트를 전체 메뉴/옵션 객체로 변환
      const serviceMenuList = menuList?.[service] || [];
      const serviceOptionList = optionList?.[service] || [];
      const { menuList: fullMenuList, optionList: fullOptionList } =
        _convertIdsToObjects(service, serviceMenuList, serviceOptionList);
      
      const params = _buildParams(service, shopInfo, {
        menuList: fullMenuList,
        optionList: fullOptionList
      });

      switch (service) {
        case 'baemin':  return BaeminService.active(page, params);
        case 'coupang': return CoupangService.active(page, params);
        case 'ddangyo': return DdangyoService.active(page, params);
        case 'yogiyo':  return YogiyoService.active(page, params);
      }
    }, req.serviceContexts);

    res.json({ success: true, data: results });
  } catch (e) {
    next(e);
  }
});

/**
 * ID 리스트를 캐시된 메뉴/옵션 전체 객체로 변환
 */
function _convertIdsToObjects(service, menuList, optionList) {
  // 캐시된 메뉴/옵션 데이터 조회
  const cachedMenuList = getCacheData(service, 'menuList');
  
  let fullMenuList = [];
  let fullOptionList = [];
  
  if (cachedMenuList) {
    // menuList가 배열이고 ID 리스트인 경우
    if (Array.isArray(menuList) && menuList.length > 0) {
      // ID가 문자열인지 객체인지 확인
      const firstItem = menuList[0];
      if (typeof firstItem === 'string' || typeof firstItem === 'number') {
        // ID 리스트인 경우 캐시에서 매칭
        fullMenuList = _findMenusByIds(cachedMenuList, menuList, service);
      } else {
        // 이미 객체 리스트인 경우
        fullMenuList = menuList;
      }
    }
    
    // optionList도 동일하게 처리
    if (Array.isArray(optionList) && optionList.length > 0) {
      const firstItem = optionList[0];
      if (typeof firstItem === 'string' || typeof firstItem === 'number') {
        fullOptionList = _findOptionsByIds(cachedMenuList, optionList, service);
      } else {
        fullOptionList = optionList;
      }
    }
  } else {
    // 캐시 없으면 원본 사용
    fullMenuList = menuList || [];
    fullOptionList = optionList || [];
  }
  
  log(`[${service}] Converted IDs to objects: menuList=${fullMenuList.length}, optionList=${fullOptionList.length}`);
  
  return { menuList: fullMenuList, optionList: fullOptionList };
}

/**
 * 캐시된 메뉴에서 ID로 매칭
 */
function _findMenusByIds(cachedMenuList, ids, service) {
  const idSet = new Set(ids.map(String));
  const results = [];
  
  // menuList가 { menuList, optionList } 구조인 경우
  const menus = cachedMenuList.menuList || cachedMenuList;
  
  if (!Array.isArray(menus)) return [];
  
  for (const menu of menus) {
    // 서비스별 ID 필드 확인
    let menuId;
    switch (service) {
      case 'baemin':
        menuId = String(menu.menuId);
        break;
      case 'coupang':
        menuId = String(menu.dishId);
        break;
      case 'ddangyo':
        menuId = String(menu.menu_id);
        break;
      case 'yogiyo':
        menuId = String(menu.product_id);
        break;
    }
    
    if (idSet.has(menuId)) {
      results.push(menu);
    }
  }
  
  return results;
}

/**
 * 캐시된 옵션에서 ID로 매칭
 */
function _findOptionsByIds(cachedMenuList, ids, service) {
  const idSet = new Set(ids.map(String));
  const results = [];
  
  // menuList가 { menuList, optionList } 구조인 경우
  const options = cachedMenuList.optionList || [];
  
  if (!Array.isArray(options)) return [];
  
  for (const option of options) {
    let optionId;
    switch (service) {
      case 'baemin':
        optionId = String(option.optionId);
        break;
      case 'coupang':
        optionId = String(option.optionItemId);
        break;
      case 'ddangyo':
        optionId = String(option.optn_id);
        break;
      case 'yogiyo':
        optionId = String(option.option_id);
        break;
    }
    
    if (idSet.has(optionId)) {
      results.push(option);
    }
  }
  
  return results;
}

/**
 * 서비스별 params 생성
 */
function _buildParams(service, shopInfo, body) {
  const { menuList, optionList, restockedAt } = body;

  switch (service) {
    case 'baemin':
      return {
        shopNo:          shopInfo.shopNo,
        shopOwnerNumber: shopInfo.shopOwnerNumber,
        menuIds:         menuList?.map(m => m.menuId || m),
        optionIds:       optionList?.map(o => o.optionId || o),
        restockedAt,
      };
    case 'coupang':
      return {
        shopId:    shopInfo.storeId,
        menuIds:   menuList?.map(m => m.dishId || m),
        optionIds: optionList?.map(o => o.optionItemId || o),
      };
    case 'ddangyo':
      return {
        patstoNo:    shopInfo.rpsnt_patsto_no,
        patstoMbrId: shopInfo.patsto_mbr_id,
        menuList,
        optionList,
      };
    case 'yogiyo':
      return {
        shop_no:        shopInfo.id,
        company_number: shopInfo.company_number,
        menuList,
        optionList,
      };
    default:
      return {};
  }
}

module.exports = router;
