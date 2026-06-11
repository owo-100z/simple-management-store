const cron = require('node-cron');
const { db } = require('../db/database');
const { log, error } = require('../utils/logger');
const { getCachedData } = require('../utils/cache');
const BaeminService  = require('../services/BaeminService');
const CoupangService = require('../services/CoupangService');
const DdangyoService = require('../services/DdangyoService');
const YogiyoService  = require('../services/YogiyoService');

let schedulerTask = null;
let serviceContexts = null; // server.js에서 주입

/**
 * serviceContexts 주입
 * server.js 시작 시 호출
 */
function setContexts(contexts) {
  serviceContexts = contexts;
}

/**
 * 오늘 날짜 문자열 반환 (YYYY-MM-DD)
 */
function today() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * 활성 스케줄 조회
 */
function getActiveSchedules() {
  return db.prepare(`
    SELECT * FROM schedules
    WHERE status = 'active'
    AND end_date >= ?
  `).all(today());
}

/**
 * 만료된 스케줄 done 처리
 */
function expireSchedules() {
  const result = db.prepare(`
    UPDATE schedules SET status = 'done'
    WHERE status = 'active'
    AND end_date < ?
  `).run(today());

  if (result.changes > 0) {
    log(`[Scheduler] 만료 스케줄 ${result.changes}건 done 처리`);
  }
}

/**
 * 서비스별 품절 실행
 */
async function executeSoldout(service, menuId, menuName) {
  if (!serviceContexts?.[service]) {
    error(`[Scheduler] ${service} 컨텍스트 없음`);
    return;
  }

  const page = serviceContexts[service].page;

  try {
    const shopInfo = await getCachedData(page, service, 'shopInfo');

    switch (service) {
      case 'baemin':
        await BaeminService.soldout(page, {
          shopNo:          shopInfo.shopNo,
          shopOwnerNumber: shopInfo.shopOwnerNumber,
          menuIds:         [menuId],
          optionIds:       [],
        });
        break;
      case 'coupang':
        await CoupangService.soldout(page, {
          shopId:    shopInfo.id,
          menuIds:   [menuId],
          optionIds: [],
        });
        break;
      case 'ddangyo':
        await DdangyoService.soldout(page, {
          patstoNo:    shopInfo.rpsnt_patsto_no,
          patstoMbrId: shopInfo.patsto_mbr_id,
          menuList:    [{ menu_id: menuId, menu_nm: menuName }],
          optionList:  [],
        });
        break;
      case 'yogiyo':
        await YogiyoService.soldout(page, {
          shop_no:        shopInfo.id,
          company_number: shopInfo.company_number,
          menuList:       [{ product_id: menuId }],
          optionList:     [],
        });
        break;
    }

    log(`[Scheduler] 품절 완료 - ${service} / menuId: ${menuId}`);
  } catch (e) {
    error(`[Scheduler] 품절 실패 - ${service} / menuId: ${menuId} / ${e.message}`);
  }
}

/**
 * 스케줄 실행 메인 로직
 */
async function runSchedules() {
  log('[Scheduler] 스케줄 실행 시작');

  // 만료 스케줄 정리
  expireSchedules();

  // 활성 스케줄 조회
  const schedules = getActiveSchedules();
  if (!schedules.length) {
    log('[Scheduler] 실행할 스케줄 없음');
    return;
  }

  log(`[Scheduler] 활성 스케줄 ${schedules.length}건 처리 시작`);

  for (const schedule of schedules) {
    const services = JSON.parse(schedule.services);

    // 서비스별 동시 품절 처리
    await Promise.allSettled(
      services.map((service) =>
        executeSoldout(service, schedule.menu_id, schedule.menu_name)
      )
    );
  }

  log('[Scheduler] 스케줄 실행 완료');
}

/**
 * 스케줄러 시작
 * 가게 영업시작시간을 DB에서 읽어서 cron 설정
 */
function start() {
  const store = db.prepare('SELECT open_time FROM store LIMIT 1').get();

  // 가게 정보 없으면 기본값 11:00
  const openTime = store?.open_time || '11:00';
  const [hour, minute] = openTime.split(':');

  log(`[Scheduler] 시작 - 매일 ${openTime} 실행`);

  schedulerTask = cron.schedule(`${minute} ${hour} * * *`, async () => {
    try {
      await runSchedules();
    } catch (e) {
      error(`[Scheduler] 실행 중 오류: ${e.message}`);
    }
  });
}

/**
 * 스케줄러 중지
 */
function stop() {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    log('[Scheduler] 중지');
  }
}

/**
 * 스케줄러 재시작 (가게 영업시간 변경 시 호출)
 */
function restart() {
  stop();
  start();
  log('[Scheduler] 재시작 완료');
}

module.exports = { start, stop, restart, setContexts, runSchedules };
