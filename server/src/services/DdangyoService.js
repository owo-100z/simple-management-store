const { api, goto, fillInputs } = require('../utils/browser');
const { log, screenshot } = require('../utils/logger');

const BASE = () => process.env.DDANGYO_URL;

const URLs = {
  login:        () => BASE(),
  shopInfo:     () => `${BASE()}/o2o/shop/cm/requestBossInfo`,
  menuList:     () => `${BASE()}/o2o/shop/me/requestChgMenuSoldOut`,
  optionList:   () => `${BASE()}/o2o/shop/me/requestChgSoldOutOpt`,
  updateMenu:   () => `${BASE()}/o2o/shop/me/requestChgMenuSoldOutUpdateWeb`,
  updateOption: () => `${BASE()}/o2o/shop/me/requestChgSoldOutOptUpdate`,
  tempStop:     () => `${BASE()}/o2o/shop/sh/requestChgBizStatListWeb`,
};

// 땡겨요 메인 페이지 보장
async function ensurePage(page) {
  if (!page.url().includes('ddangyo.com')) {
    log('[ddangyo] 페이지 이동 → DDANGYO_URL');
    await goto(page, process.env.DDANGYO_URL, 15000, 'domcontentloaded');
  }
}

// ─────────────────────────────────────────────
// 로그인
// ─────────────────────────────────────────────
async function login(page, username, password) {
  try {
    await fillInputs(page, [
      { selector: 'input[id="mf_ibx_mbrId"]', value: username },
      { selector: 'input[id="mf_sct_pwd"]',   value: password },
    ]);

    await page.click('input[id="mf_btn_webLogin"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    return { success: true };
  } catch (e) {
    if (page.url().includes(process.env.DDANGYO_URL)) {
      // 이미 페이지에 있는 경우
      return { success: true };
    } else {
      await screenshot(page, 'ddangyo-login-err');
      return { success: false, error: e.message };
    }
  }
}

// ─────────────────────────────────────────────
// 상점 정보 조회
// ─────────────────────────────────────────────
async function getShopInfo(page) {
  await ensurePage(page);

  const res = await api(page, 'POST', URLs.shopInfo());
  // log(`getShopInfo: ${JSON.stringify(res)}`);
  
  if (!res?.dma_result) {
    return { success: false, error: 'Shop info not found' };
  }
  
  return res.dma_result;
}

// ─────────────────────────────────────────────
// 메뉴 조회
// ─────────────────────────────────────────────
async function getMenuList(page, params) {
  await ensurePage(page);

  const data = {
    dma_para: {
      patsto_no:    params.patstoNo,
      menu_search:  params.menuName || '',
      menu_grp_id:  '',
      group_div_cd: 0,
      pos_div_cd:   '',
    },
  };

  const res = await api(page, 'POST', URLs.menuList(), { data });
  return res?.dlt_menuSoldOut?.filter((m) => m.hide !== '1' && m.hide_yn !== '1') ?? [];
}

// ─────────────────────────────────────────────
// 옵션 조회
// ─────────────────────────────────────────────
async function getOptionList(page, params) {
  await ensurePage(page);

  const data = {
    dma_para: {
      patsto_no:           params.patstoNo,
      optn_search:         params.optionName || '',
      optn_grp_id:         '',
      group_div_cd:        0,
      optn_grp_nm:         '',
      ncsr_yn:             '',
      min_optn_choice_cnt: '',
      max_optn_choice_cnt: '',
      all_optn_choice_cnt: '',
    },
  };

  const res = await api(page, 'POST', URLs.optionList(), { data });
  return res?.dlt_menuOption?.filter((o) => o.hide_yn !== '1') ?? [];
}

// ─────────────────────────────────────────────
// 전체 메뉴+옵션 조회 (캐시용)
// ─────────────────────────────────────────────
async function getAllMenuList(page, params) {
  if (!params?.patstoNo) return { success: false, error: 'patstoNo is required' };
  const menuList   = await getMenuList(page, params);
  const optionList = await getOptionList(page, params);
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
      dma_req: {
        menu_id:      menu.menu_id,
        menu_grp_nm:  menu.menu_grp_nm,
        menu_nm:      menu.menu_nm,
        patsto_no:    params.patstoNo,
        fin_chg_id:   params.patstoMbrId,
        sldot_yn:     params.status,
        hide_yn:      '',
        pckg_hide_yn: '',
        sto_hide_yn:  '',
      },
    };
    const res = await api(page, 'POST', URLs.updateMenu(), { data });
    results.push({ success: res?.dma_error?.result === 'SUCCESS', ...res });
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
      dma_req: {
        optn_grp_id:       option.optn_grp_id,
        optn_grp_nm:       option.optn_grp_nm,
        optn_nm:           option.optn_nm,
        optn_id:           option.optn_id,
        patsto_no:         params.patstoNo,
        fin_chg_id:        params.patstoMbrId,
        sldot_yn:          params.status,
        hide_yn:           '',
        optn_sell_stat_cd: '',
      },
    };
    const res = await api(page, 'POST', URLs.updateOption(), { data });
    results.push({ success: res?.dma_error?.result === 'SUCCESS', ...res });
  }

  log(`_updateOptions: ${JSON.stringify(results)}`);
  return results;
}

// ─────────────────────────────────────────────
// 품절
// ─────────────────────────────────────────────
async function soldout(page, params) {
  await ensurePage(page);
  const menuResult   = await _updateMenus(page,   { ...params, status: '1' });
  const optionResult = await _updateOptions(page, { ...params, status: '1' });
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
  const menuResult   = await _updateMenus(page,   { ...params, status: '0' });
  const optionResult = await _updateOptions(page, { ...params, status: '0' });
  return {
    success:   menuResult.every((r) => r.success) && optionResult.every((r) => r.success),
    failcount: menuResult.filter((r) => !r.success).length + optionResult.filter((r) => !r.success).length,
    menuResult, optionResult,
  };
}

// ─────────────────────────────────────────────
// 임시중지 / 임시휴무일 설정
// ─────────────────────────────────────────────
async function temporaryStop(page, params) {
  await ensurePage(page);

  let to = params.to?.replace(/[^0-9]/g, '') || '';
  
  // 시간 형식 처리 (12자리면 초 추가)
  if (to.length !== 14 && to.length === 12) {
    to = to + '00';
  }

  const data = {
    dlt_req: [
      {
        patsto_no:             params.patstoNo,
        patsto_biz_stat_cd:    to ? '03' : '01',
        patsto_biz_stop_rsn_cd: to ? '01' : '00',
        delv_ord_posb_yn:      to ? '0' : '1',
        pckg_ord_posb_yn:      to ? '0' : '1',
        sto_ord_posb_yn:       to ? '0' : '1',
        fin_chg_id:            params.finChgId,
        patsto_biz_stop_time:  to || '',
        rowStatus:             'C',
      },
    ],
  };

  const res = await api(page, 'POST', URLs.tempStop(), { data });
  log(`temporaryStop: ${JSON.stringify(res)}`);
  return res;
}

module.exports = {
  login, getShopInfo, getAllMenuList, getMenuList,
  getOptionList, soldout, active, temporaryStop,
};