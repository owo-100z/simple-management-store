const { api, goto, fillInputs } = require('../utils/browser');
const { log, screenshot } = require('../utils/logger');
const { toDateParts, nowString } = require('../utils/date');

const BASE = () => process.env.COUPANG_API_BASE;

function cpApi(page, method, url, options = {}) {
  return api(page, method, url, {
    headers: { 'Accept-Language': 'ko-KR' },
    ...options,
  });
}

const URLs = {
  login:        () => process.env.COUPANG_LOGIN_URL,
  shopInfo:     () => `${BASE()}/api/v1/merchant/detail/form`,
  menuList:     (shopId) => `${BASE()}/api/v1/merchant/web/stores/${shopId}/all-menu-dishes`,
  optionList:   (shopId) => `${BASE()}/api/v1/merchant/web/stores/${shopId}/all-options?fetchDish=true`,
  updateMenu:   (shopId) => `${BASE()}/api/v1/merchant/web/catalog/stores/${shopId}/dishes/update-status`,
  updateOption: (shopId) => `${BASE()}/api/v1/merchant/web/catalog/stores/${shopId}/option-items/update-status`,
  holidays:     (shopId) => `${BASE()}/api/v1/merchant/web/stores/${shopId}/irregularholidays`,
};

// 쿠팡 메인 페이지 보장
async function ensurePage(page) {
  if (!page.url().includes('coupangeats.com') || page.url().includes('login')) {
    log('[coupang] 페이지 이동 → COUPANG_URL');
    await goto(page, process.env.COUPANG_URL, 10000, 'networkidle2');
  }
}

// ─────────────────────────────────────────────
// 로그인
// ─────────────────────────────────────────────
async function login(page, username, password, attemptCnt = 0) {
  if (attemptCnt >= 3) { // 3회 시도부터는 바로 컷 (0, 1, 2회까지 시도)
    return { success: false, error: '로그인 시도 3회 이상 실패. 잠시 후 다시 시도해 주세요.' };
  }
  
  try {
    await goto(page, URLs.login(), 10000, 'domcontentloaded');

    await fillInputs(page, [
      { selector: '#loginId',  value: username },
      { selector: '#password', value: password },
    ]);

    await page.click('button[type="submit"]');
    
    let hasErrorText = false;
    
    try {
      // 에러 문구가 뜨는지 확인
      await page.waitForSelector('.login-error-text', { visible: true, timeout: 2000 });
      hasErrorText = true; // 에러 문구 발견!
    } catch (e) {
      // 2초 동안 에러 문구가 안 떴다면 (TimeoutError) 로그인 성공 궤도로 간주
      hasErrorText = false;
    }

    // 1. 에러 문구를 발견했다면 깔끔하게 재귀 호출로 재시도
    if (hasErrorText) {
      console.log(`[로그인 실패] 에러 문구 감지. 재시도합니다... (${attemptCnt + 1}/3)`);
      return login(page, username, password, attemptCnt + 1);
    }

    // 2. 에러 문구가 없다면 안전하게 페이지 이동 대기 후 성공 반환
    // (간혹 내비게이션이 이미 완료되었을 수 있으므로 .catch로 타임아웃 씹어주기)
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 4000 }).catch(() => {
      console.log("내비게이션 대기 타임아웃 (이미 다음 페이지로 이동했을 수 있음)");
    });
    
    return { success: true };

  } catch (e) {
    // 네트워크 단절이나 셀렉터 에러 등 진짜 뻑났을 때만 스크린샷 덤프
    await screenshot(page, `coupang-login-err-attempt-${attemptCnt}`);
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────
// 상점 정보 조회
// ─────────────────────────────────────────────
async function getShopInfo(page) {
  await ensurePage(page);

  const res = await cpApi(page, 'GET', URLs.shopInfo());
  // log(`getShopInfo: ${JSON.stringify(res)}`);

  if (!res?.data) {
    return { success: false, error: res?.error || 'Shop info not found' };
  }
  return { ...res.data };
}

// ─────────────────────────────────────────────
// 메뉴 조회
// ─────────────────────────────────────────────
async function getMenuList(page, params) {
  await ensurePage(page);

  const res = await cpApi(page, 'GET', URLs.menuList(params.shopId));

  return res?.data?.menus?.reduce((acc, menu) => {
    menu.dishes?.forEach((dish) => {
      if (dish.displayStatus !== 'NOT_EXPOSE') {
        acc.push({ ...dish, menuId: menu.menuId, menuName: menu.menuName });
      }
    });
    return acc;
  }, []) ?? [];
}

// ─────────────────────────────────────────────
// 옵션 조회
// ─────────────────────────────────────────────
async function getOptionList(page, params) {
  await ensurePage(page);

  const res = await cpApi(page, 'GET', URLs.optionList(params.shopId));

  return res?.data?.reduce((acc, group) => {
    group.optionItems?.forEach((option) => {
      if (option.displayStatus !== 'NOT_EXPOSE') {
        acc.push({ ...option, groupId: group.optionId, groupName: group.optionName });
      }
    });
    return acc;
  }, []) ?? [];
}

// ─────────────────────────────────────────────
// 전체 메뉴+옵션 조회 (캐시용)
// ─────────────────────────────────────────────
async function getAllMenuList(page, params) {
  if (!params?.shopId) return { success: false, error: 'shopId is required' };
  const menuList   = await getMenuList(page, params);
  const optionList = await getOptionList(page, params);
  return { menuList, optionList };
}

// ─────────────────────────────────────────────
// 메뉴/옵션 상태 변경
// ─────────────────────────────────────────────
async function _updateMenus(page, params) {
  if (!params.menuIds?.length) return { success: true, message: 'menuIds is empty' };
  const data = params.menuIds.map((dishId) => ({ dishId, displayStatus: params.status }));
  const res  = await cpApi(page, 'POST', URLs.updateMenu(params.shopId), { data });
  return { success: res?.code === 'SUCCESS', ...res };
}

async function _updateOptions(page, params) {
  if (!params.optionIds?.length) return { success: true, message: 'optionIds is empty' };
  const data = params.optionIds.map((optionItemId) => ({ optionItemId, displayStatus: params.status }));
  const res  = await cpApi(page, 'POST', URLs.updateOption(params.shopId), { data });
  return { success: res?.code === 'SUCCESS', ...res };
}

// ─────────────────────────────────────────────
// 품절
// ─────────────────────────────────────────────
async function soldout(page, params) {
  await ensurePage(page);
  const menuResult   = await _updateMenus(page,   { ...params, status: 'SOLD_OUT_TODAY' });
  const optionResult = await _updateOptions(page, { ...params, status: 'SOLD_OUT_TODAY' });
  return { success: menuResult.success && optionResult.success, menuResult, optionResult };
}

// ─────────────────────────────────────────────
// 품절 해제
// ─────────────────────────────────────────────
async function active(page, params) {
  await ensurePage(page);
  const menuResult   = await _updateMenus(page,   { ...params, status: 'ON_SALE' });
  const optionResult = await _updateOptions(page, { ...params, status: 'ON_SALE' });
  return { success: menuResult.success && optionResult.success, menuResult, optionResult };
}

// ─────────────────────────────────────────────
// 임시휴무일 설정/해제
// ─────────────────────────────────────────────
async function irregularHolidays(page, params) {
  await ensurePage(page);

  let from = params.from ? params.from.replace(/[^0-9]/g, '') : nowString();
  let to   = params.to?.replace(/[^0-9]/g, '');

  if (from?.length === 12) from = from + '00';
  if (to?.length   === 12) to   = to   + '00';
  if (from > to) return { success: false, error: 'from cannot be later than to' };

  const fromParts = toDateParts(from);
  const toParts   = toDateParts(to);

  const irregularHolidayDto = fromParts && toParts
    ? {
        id: -1,
        fromYear: fromParts.year, fromMonth: fromParts.month, fromDay: fromParts.day,
        fromHour: fromParts.hour, fromMinute: fromParts.minute,
        toYear:   toParts.year,  toMonth:   toParts.month,   toDay:   toParts.day,
        toHour:   toParts.hour,  toMinute:  toParts.minute,
      }
    : null;

  const data = { irregularHolidayDtoList: irregularHolidayDto ? [irregularHolidayDto] : [] };
  const res  = await cpApi(page, 'POST', URLs.holidays(params.shopId), { data });
  log(`irregularHolidays: ${JSON.stringify(res)}`);
  return res;
}

module.exports = {
  login, getShopInfo, getAllMenuList, getMenuList,
  getOptionList, soldout, active, irregularHolidays,
};