const { api, goto, fillInputs } = require('../utils/browser');
const { log, screenshot } = require('../utils/logger');
const { toDateTimeShort } = require('../utils/date');

const URLs = {
  login:        () => process.env.YOGIYO_LOGIN_URL,
  shopInfo:     () => `${process.env.YOGIYO_API_BASE_CEO}/vendor/?is_contracted=1`,
  menuList:     (shopNo, companyNo, size) =>
    `${process.env.YOGIYO_API_BASE_OWNER}/menu/${shopNo}/invisible-list/?company_number=${companyNo}&size=${size}`,
  optionList:   (shopNo, companyNo, size) =>
    `${process.env.YOGIYO_API_BASE_OWNER}/options/${shopNo}/?company_number=${companyNo}&size=${size}`,
  updateMenu:   (shopNo, menuId) =>
    `${process.env.YOGIYO_API_BASE_OWNER}/menu/${shopNo}/${menuId}/`,
  updateOption: (shopNo, optionId) =>
    `${process.env.YOGIYO_API_BASE_OWNER}/ajax/flavors/ingredient/${shopNo}/${optionId}/invisible/`,
  tempStop:     (shopNo) =>
    `${process.env.YOGIYO_API_BASE_CEO}/vendor/${shopNo}/pause/`,
};

// 요기요 메인 페이지 보장
async function ensurePage(page) {
  if (!page.url().includes('yogiyo.co.kr') || page.url().includes('login')) {
    log('[yogiyo] 페이지 이동 → YOGIYO_URL');
    await goto(page, process.env.YOGIYO_URL, 15000, 'networkidle2');
  }
}

async function ygApi(page, method, url, options = {}) {
  const cookies     = await page.cookies();
  const accessToken = cookies.find((c) => c.name === 'EXT_ACCESS_TOKEN')?.value;
  return api(page, method, url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    ...options,
  });
}

// ─────────────────────────────────────────────
// 로그인
// ─────────────────────────────────────────────
async function login(page, username, password) {
  try {
    await goto(page, URLs.login(), 15000, 'networkidle2');

    await fillInputs(page, [
      { selector: 'input[name="username"]', value: username },
      { selector: 'input[name="password"]', value: password },
    ]);

    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    await goto(page, process.env.YOGIYO_URL, 15000, 'networkidle2');

    return { success: true };
  } catch (e) {
    await screenshot(page, 'yogiyo-login-err');
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────
// 상점 정보 조회
// ─────────────────────────────────────────────
async function getShopInfo(page) {
  await ensurePage(page);

  const res = await ygApi(page, 'GET', URLs.shopInfo());
  // log(`getShopInfo: ${JSON.stringify(res)}`);

  if (!res?.length) return { success: false, error: 'Shop info not found' };
  return { ...res[0] };
}

// ─────────────────────────────────────────────
// 메뉴 조회
// ─────────────────────────────────────────────
async function getMenuList(page, params) {
  await ensurePage(page);

  const res = await ygApi(page, 'GET', URLs.menuList(params.shop_no, params.company_number, params.size));
  // log(`getMenuList: ${JSON.stringify(res)}`);

  try {
    return res?.data?.reduce((acc, cur) => {
      return [...acc, ...cur.products.filter((p) => !(p.invisible && p.invisible_until))];
    }, []) ?? [];
  } catch { return []; }
}

// ─────────────────────────────────────────────
// 옵션 조회
// ─────────────────────────────────────────────
async function getOptionList(page, params) {
  await ensurePage(page);

  const res = await ygApi(page, 'GET', URLs.optionList(params.shop_no, params.company_number, params.size));
  // log(`getOptionList: ${JSON.stringify(res)}`);

  try {
    return res?.data?.reduce((acc, cur) => {
      return [...acc, ...cur.options.filter((o) => !(o.invisible && o.invisible_until))];
    }, []) ?? [];
  } catch { return []; }
}

// ─────────────────────────────────────────────
// 전체 메뉴+옵션 조회 (캐시용)
// ─────────────────────────────────────────────
async function getAllMenuList(page, params) {
  const size = 500;
  const menuList   = await getMenuList(page,   { ...params, size });
  const optionList = await getOptionList(page, { ...params, size });
  return { menuList, optionList };
}

// ─────────────────────────────────────────────
// 메뉴 상태 변경
// ─────────────────────────────────────────────
async function _updateMenus(page, params) {
  if (!Array.isArray(params.menuList) || !params.menuList.length) {
    return [{ success: true, message: 'menuList is empty' }];
  }

  const results = [];
  for (const menu of params.menuList) {
    const data = {
      company_number: params.company_number,
      ...(params.type === 'soldout' && { invisible: true }),
    };
    const res = await ygApi(page, 'POST', URLs.updateMenu(params.shop_no, menu.product_id), { data });
    results.push({ success: true, ...res });
  }

  log(`_updateMenus: ${JSON.stringify(results)}`);
  return results;
}

// ─────────────────────────────────────────────
// 옵션 상태 변경
// ─────────────────────────────────────────────
async function _updateOptions(page, params) {
  if (!Array.isArray(params.optionList) || !params.optionList.length) {
    return [{ success: true, message: 'optionList is empty' }];
  }

  const results = [];
  for (const option of params.optionList) {
    const data = {
      oneday_invisible:   params.type === 'soldout' ? 'on' : '',
      longterm_invisible: '',
      company_number:     params.company_number,
    };
    const res = await ygApi(page, 'PUT', URLs.updateOption(params.shop_no, option.option_id), { data });
    results.push({ success: res?.invisible === (params.type === 'soldout'), ...res });
  }

  log(`_updateOptions: ${JSON.stringify(results)}`);
  return results;
}

// ─────────────────────────────────────────────
// 품절
// ─────────────────────────────────────────────
async function soldout(page, params) {
  await ensurePage(page);
  const menuResult   = await _updateMenus(page,   { ...params, type: 'soldout' });
  const optionResult = await _updateOptions(page, { ...params, type: 'soldout' });
  return {
    success:   menuResult.every((r) => r.success) && optionResult.every((r) => r.success),
    failcount: menuResult.filter((r) => !r.success).length + optionResult.filter((r) => !r.success).length,
    menuResult, optionResult,
  };
}

// ─────────────────────────────────────────────
// 품절 해제
// ─────────────────────────────────────────────
async function active(page, params) {
  await ensurePage(page);
  const menuResult   = await _updateMenus(page,   { ...params, type: 'release' });
  const optionResult = await _updateOptions(page, { ...params, type: 'release' });
  return {
    success:   menuResult.every((r) => r.success) && optionResult.every((r) => r.success),
    failcount: menuResult.filter((r) => !r.success).length + optionResult.filter((r) => !r.success).length,
    menuResult, optionResult,
  };
}

// ─────────────────────────────────────────────
// 임시중지
// ─────────────────────────────────────────────
async function temporaryStop(page, params) {
  await ensurePage(page);

  const toStr = toDateTimeShort(params.to);
  if (!toStr) return { success: false, message: 'Invalid to date. Use "YYYYMMDDHHmm"' };

  const data = {
    order_type:            'delivery',
    apply_related_vendors: false,
    minutes:               null,
    day:                   null,
    end_datetime:          toStr,
  };

  await ygApi(page, 'POST', URLs.tempStop(params.shop_no), { data });
  const res = await ygApi(page, 'GET', URLs.tempStop(params.shop_no));
  log(`temporaryStop: ${JSON.stringify(res)}`);

  return {
    success: !res?.is_open,
    message: `임시중지가 ${!res?.is_open ? '정상 처리되었습니다' : '실패하였습니다'}`,
  };
}

// ─────────────────────────────────────────────
// 임시중지 해제
// ─────────────────────────────────────────────
async function releaseStop(page, params) {
  await ensurePage(page);

  const stopStatus = await ygApi(page, 'GET', URLs.tempStop(params.shop_no));
  if (stopStatus?.is_open) return { success: true, message: '임시중지가 이미 해제되었습니다.' };

  const pauseId = stopStatus?.pause?.id;
  if (!pauseId) return { success: false, message: '해제할 ID를 찾지 못했습니다.' };

  const deleteUrl = `${URLs.tempStop(params.shop_no)}${pauseId}/?apply_related_vendors=false`;
  await ygApi(page, 'DELETE', deleteUrl);

  const res = await ygApi(page, 'GET', URLs.tempStop(params.shop_no));
  log(`releaseStop: ${JSON.stringify(res)}`);

  return {
    success: res?.is_open,
    message: `임시중지 해제가 ${res?.is_open ? '정상 처리되었습니다' : '실패하였습니다'}`,
  };
}

module.exports = {
  login, getShopInfo, getAllMenuList, getMenuList,
  getOptionList, soldout, active, temporaryStop, releaseStop,
};