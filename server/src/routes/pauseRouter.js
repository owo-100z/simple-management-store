const express = require('express');
const router = express.Router();
const { createLoginMiddleware } = require('../middleware/loginMiddleware');
const { getCachedData } = require('../utils/cache');
const BaeminService  = require('../services/BaeminService');
const CoupangService = require('../services/CoupangService');
const DdangyoService = require('../services/DdangyoService');
const YogiyoService  = require('../services/YogiyoService');
const { executeAll } = require('../services/CommonService');

const SERVICES = ['baemin', 'coupang', 'ddangyo', 'yogiyo'];

// 선택된 서비스에 대해서만 로그인 미들웨어 적용
function createSelectiveLoginMiddleware(services) {
  return (req, res, next) => {
    const selectedServices = req.body.services || services;
    const middlewares = selectedServices.map(service => createLoginMiddleware(service));
    
    // 순차적으로 미들웨어 실행
    const runMiddleware = async (index) => {
      if (index >= middlewares.length) {
        return next();
      }
      await new Promise((resolve) => {
        middlewares[index](req, res, (err) => {
          if (err) return next(err);
          resolve();
        });
      });
      runMiddleware(index + 1);
    };
    
    runMiddleware(0);
  };
}

/**
 * 임시중지
 * POST /api/pause
 * body: {
 *   services: ['baemin', 'coupang', ...],
 *   from: '202606061100',   (배민만 사용, 없으면 현재시간)
 *   to:   '202606061800'
 * }
 */
router.post('/', createSelectiveLoginMiddleware(SERVICES), async (req, res, next) => {
  try {
    const { services = SERVICES, from, to } = req.body;

    const results = await executeAll(services, async (service, page) => {
      const shopInfo = await getCachedData(page, service, 'shopInfo');

      switch (service) {
        case 'baemin':
          return BaeminService.temporaryStop(page, { from, to });
        case 'coupang':
          return CoupangService.irregularHolidays(page, { shopId: shopInfo.storeId, from, to });
        case 'ddangyo':
          return DdangyoService.temporaryStop(page, {
            patstoNo: shopInfo.rpsnt_patsto_no,
            finChgId: shopInfo.patsto_mbr_id,
            to,
          });
        case 'yogiyo':
          return YogiyoService.temporaryStop(page, { shop_no: shopInfo.id, to });
      }
    }, req.serviceContexts);

    res.json({ success: true, data: results });
  } catch (e) {
    next(e);
  }
});

/**
 * 임시중지 해제
 * POST /api/pause/release
 * body: { services: ['baemin', 'coupang', ...] }
 */
router.post('/release', createSelectiveLoginMiddleware(SERVICES), async (req, res, next) => {
  try {
    const { services = SERVICES } = req.body;

    const results = await executeAll(services, async (service, page) => {
      const shopInfo = await getCachedData(page, service, 'shopInfo');

      switch (service) {
        case 'baemin':
          return BaeminService.releaseStop(page);
        case 'coupang':
          return CoupangService.irregularHolidays(page, { shopId: shopInfo.storeId });
        case 'ddangyo':
          return DdangyoService.temporaryStop(page, {
            patstoNo: shopInfo.rpsnt_patsto_no,
            finChgId: shopInfo.patsto_mbr_id,
          });
        case 'yogiyo':
          return YogiyoService.releaseStop(page, { shop_no: shopInfo.id });
      }
    }, req.serviceContexts);

    res.json({ success: true, data: results });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
