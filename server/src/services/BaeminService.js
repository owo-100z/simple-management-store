const { api, goto, fillInputs } = require('../utils/browser');
const { log, screenshot } = require('../utils/logger');
const { toDateTimeString, nowString } = require('../utils/date');

const BASE        = () => process.env.BAEMIN_API_BASE;
const OWNER_V1    = () => `${BASE()}/v1/menu-sys/core/v1/shop-owners/`;
const OWNER_V2    = () => `${BASE()}/v1/menu-sys/core/v2/shop-owners/`;

const URLs = {
  login:         () => process.env.BAEMIN_LOGIN_URL,
  ownerInfo:     () => `${BASE()}/v1/session/profile`,
  shopInfo:      () => `${BASE()}/v4/store/shops/search`,
  menuList:      (n) => `${OWNER_V2()}${n}/menus/one-shop`,
  optionList:    (n) => `${OWNER_V1()}${n}/option-groups`,
  soldoutMenu:   (n) => `${OWNER_V2()}${n}/status/menus/soldout`,
  activeMenu:    (n) => `${OWNER_V2()}${n}/status/menus/active`,
  soldoutOption: (n) => `${OWNER_V2()}${n}/status/options/soldout`,
  activeOption:  (n) => `${OWNER_V2()}${n}/status/options/active`,
  temporaryStop: () => `${BASE()}/v4/store/shops/delivery-type-temporary-stop`,
};

function bmApi(page, method, url, options = {}) {
  return api(page, method, url, {
    headers: { 'service-channel': 'SELF_SERVICE_PC' },
    ...options,
  });
}

// 배민 메인 페이지 보장
async function ensurePage(page) {
  if (!page.url().includes(process.env.BAEMIN_URL)) {
    log('[baemin] 페이지 이동 → BAEMIN_URL');
    await goto(page, process.env.BAEMIN_URL, 10000, 'domcontentloaded');
  }
}

// ─────────────────────────────────────────────
// 로그인
// ─────────────────────────────────────────────
async function login(page, username, password) {
  try {
    await goto(page, URLs.login(), 10000, 'domcontentloaded');

    // fillInputs 대신 page.type() 사용 (실제 키보드 입력 시뮬레이션)
    try {
      await page.waitForSelector('input[name="id"]', { visible: true });
    } catch (e) {
      // 현재 페이지가 로그인페이지가 아닌 경우 로그인으로 간주
      const isLoggedIn = !page.url().includes(URLs.login());

      return { success: true };
    }

    await page.click('input[name="id"]');
    await page.type('input[name="id"]', username);

    await page.click('input[name="password"]');
    await page.type('input[name="password"]', password);

    await page.waitForSelector('button[type="submit"]', { visible: true });

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);

    await goto(page, process.env.BAEMIN_URL, 10000, 'domcontentloaded');
    return { success: true };
  } catch (e) {
    if (page.url().includes(process.env.BAEMIN_URL)) {
      // 이미 페이지에 있는 경우
      return { success: true };
    } else {
      await screenshot(page, 'baemin-login-err');
      return { success: false, error: e.message };
    }
  }
}

// ─────────────────────────────────────────────
// 상점 정보 조회
// ─────────────────────────────────────────────
async function getShopInfo(page) {
  await ensurePage(page);

  const ownerInfo = await bmApi(page, 'GET', URLs.ownerInfo());
  // log(`getOwnerInfo: ${JSON.stringify(ownerInfo)}`);

  if (!ownerInfo?.shopOwnerNumber) {
    return { success: false, error: ownerInfo?.errorMessage || 'Owner info not found' };
  }

  const shopInfo = await bmApi(page, 'GET', URLs.shopInfo(), {
    data: { shopOwnerNo: ownerInfo.shopOwnerNumber },
  });
  // log(`getShopInfo: ${JSON.stringify(shopInfo)}`);

  if (!shopInfo?.content?.length) {
    return { success: false, error: shopInfo?.errorMessage || 'Shop info not found' };
  }

  return { ...ownerInfo, ...shopInfo.content[0] };
}

// ─────────────────────────────────────────────
// 메뉴 조회 (페이지별)
// ─────────────────────────────────────────────
async function getMenuList(page, params) {
  await ensurePage(page);

  const response = await bmApi(page, 'GET', URLs.menuList(params.shopOwnerNumber), {
    data: {
      shopId:   params.shopNo,
      menuName: params.menuName,
      page:     params.menuName ? 0 : params.page,
      size:     20,
    },
  });

  if (!response?.data) return { data: { content: [], last: true } };
  response.data.content = response.data.content.filter(
    (menu) => menu.menuStatusResponse?.status !== 'HIDE'
  );
  return response;
}

// ─────────────────────────────────────────────
// 옵션 조회
// ─────────────────────────────────────────────
async function getOptionList(page, params) {
  await ensurePage(page);

  const response = await bmApi(page, 'GET', URLs.optionList(params.shopOwnerNumber), {
    data: {
      optionName: params.optionName,
      page:       params.optionName ? 0 : params.page,
      size:       20,
    },
  });

  if (!response?.data?.content) return [];

  return response.data.content.reduce((acc, group) => {
    if (group.options?.length) {
      group.options.forEach((option) => {
        if (option.itemStatus !== 'HIDE') {
          acc.push({ ...option, groupName: group.name, groupId: group.id });
        }
      });
    }
    return acc;
  }, []);
}

// ─────────────────────────────────────────────
// 전체 메뉴+옵션 조회 (캐시용)
// ─────────────────────────────────────────────
async function getAllMenuList(page, params) {
  let menuList = [];
  let page_no = 0;
  let last = false;

  while (!last) {
    const res = await getMenuList(page, { ...params, page: page_no });
    menuList = [...menuList, ...res.data.content];
    last = res.data.last;
    page_no++;
  }

  const optionList = await getOptionList(page, { ...params, page: 0 });
  return { menuList, optionList };
}

// ─────────────────────────────────────────────
// 품절
// ─────────────────────────────────────────────
async function soldout(page, params) {
  await ensurePage(page);
  const menuResult   = await _soldoutMenu(page, params);
  const optionResult = await _soldoutOption(page, params);
  return { success: menuResult.success && optionResult.success, menuResult, optionResult };
}

async function _soldoutMenu(page, params) {
  if (!params.menuIds?.length) return { success: true, message: 'menuIds is empty' };
  const res = await bmApi(page, 'PUT', URLs.soldoutMenu(params.shopOwnerNumber), {
    data: { menuIds: params.menuIds, restockedAt: params.restockedAt },
  });
  return { success: res?.code === 200, ...res };
}

async function _soldoutOption(page, params) {
  if (!params.optionIds?.length) return { success: true, message: 'optionIds is empty' };
  const res = await bmApi(page, 'PUT', URLs.soldoutOption(params.shopOwnerNumber), {
    data: { optionIds: params.optionIds, restockedAt: params.restockedAt },
  });
  return { success: res?.code === 200, ...res };
}

// ─────────────────────────────────────────────
// 품절 해제
// ─────────────────────────────────────────────
async function active(page, params) {
  await ensurePage(page);
  const menuResult   = await _activeMenu(page, params);
  const optionResult = await _activeOption(page, params);
  return { success: menuResult.success && optionResult.success, menuResult, optionResult };
}

async function _activeMenu(page, params) {
  if (!params.menuIds?.length) return { success: true, message: 'menuIds is empty' };
  const res = await bmApi(page, 'PUT', URLs.activeMenu(params.shopOwnerNumber), {
    data: { menuIds: params.menuIds },
  });
  return { success: res?.code === 200, ...res };
}

async function _activeOption(page, params) {
  if (!params.optionIds?.length) return { success: true, message: 'optionIds is empty' };
  const res = await bmApi(page, 'PUT', URLs.activeOption(params.shopOwnerNumber), {
    data: { optionIds: params.optionIds },
  });
  return { success: res?.code === 200, ...res };
}

// ─────────────────────────────────────────────
// 임시중지
// ─────────────────────────────────────────────
async function temporaryStop(page, params) {
  await ensurePage(page);

  let from = params.from ? params.from.replace(/[^0-9]/g, '') : nowString();
  let to   = params.to?.replace(/[^0-9]/g, '');

  if (from?.length === 12) from = from + '00';
  if (to?.length === 12)   to   = to   + '00';

  if (!from || from.length !== 14) return { success: false, message: 'Invalid from date' };
  if (!to   || to.length   !== 14) return { success: false, message: 'Invalid to date' };
  if (from > to) return { success: false, message: 'from cannot be later than to' };

  const data = {
    reason: 'PERSONAL_REASON',
    temporaryStops: [
      { deliveryType: 'OWN_DELIVERY',    startDate: toDateTimeString(from), endDate: toDateTimeString(to) },
      { deliveryType: 'AGENCY_DELIVERY', startDate: toDateTimeString(from), endDate: toDateTimeString(to) },
      { deliveryType: 'VISIT',           startDate: toDateTimeString(from), endDate: toDateTimeString(to) },
    ],
  };

  const res = await bmApi(page, 'PUT', URLs.temporaryStop(), { data });
  log(`temporaryStop: ${JSON.stringify(res)}`);
  return res;
}

// ─────────────────────────────────────────────
// 임시중지 해제
// ─────────────────────────────────────────────
async function releaseStop(page) {
  await ensurePage(page);
  const res = await bmApi(page, 'DELETE', URLs.temporaryStop());
  log(`releaseStop: ${JSON.stringify(res)}`);
  return res;
}

module.exports = {
  login, getShopInfo, getAllMenuList, getMenuList,
  getOptionList, soldout, active, temporaryStop, releaseStop,
};