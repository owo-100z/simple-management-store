const common = require('./common');

/**
 * 로그인
 * @param {object} page - Page 인스턴스
 * @param {string} username - 로그인 아이디
 * @param {string} password - 로그인 비밀번호
 */
async function login(page, username, password) {
    try {
      await page.type('input[id="mf_ibx_mbrId"]', username);
      await page.type('input[id="mf_sct_pwd"]', password);
      await page.click('input[id="mf_btn_webLogin"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
      
      return { success: true };
    } catch (e) {
      common.log(e);
      return { success: false, error: e.message };
    }
}

/**
 * 상점 정보 조회
 * @param {object} page - Page 인스턴스
 * @returns {Promise<any>} - 상점 정보
 */
async function getShopInfo(page) {
    const shopInfoUrl = process.env.DG_SHOP_INFO_URL;
    const shopInfo = await common.api(page, 'POST', shopInfoUrl);
    common.log(`getShopInfo: ${JSON.stringify(shopInfo)}`);

    const response = shopInfo.dma_result;
    return response;
}

/**
 * 메뉴 목록 조회 (페이지별)
 * @param {object} page - Page 인스턴스
 * @param {object} params - 파라미터
 * @returns {Promise<any>} - 메뉴 목록
 */
async function getMenuList(page, params) {
    const menuListUrl = process.env.DG_GET_MENU_LIST_URL;

    const data = {
        dma_para: {
            patsto_no: params.patstoNo,
            menu_search: params.menuName || '',
            menu_grp_id: '',
            group_div_cd: 0,
            pos_div_cd: '',
        }
    }
    const menuList = await common.api(page, 'POST', menuListUrl, { data });
    common.log(`getMenuList: ${JSON.stringify(menuList)}`);

    const response = menuList.dlt_menuSoldOut.filter(menu => menu.hide !== '1' && menu.hide_yn !== '1');
    return response;
}

/**
 * 옵션 목록 조회
 * @param {object} page - Page 인스턴스
 * @param {object} params - 파라미터
 * @returns {Promise<any>} - 옵션 목록
 */
async function getOptionList(page, params) {
    const optionListUrl = process.env.DG_GET_OPTION_URL;

    const data = {
        dma_para: {
            patsto_no: params.patstoNo,
            optn_search: params.optionName || '',
            optn_grp_id: '',
            group_div_cd: 0,
            optn_grp_nm: '',
            ncsr_yn: '',
            min_optn_choice_cnt: '',
            max_optn_choice_cnt: '',
            all_optn_choice_cnt: '',
        }
    }

    const optionList = await common.api(page, 'POST', optionListUrl, { data });
    common.log(`getOptionList: ${JSON.stringify(optionList)}`);

    const response = optionList.dlt_menuOption.filter(option => option.hide_yn !== '1');
    return response;
}

/**
 * 메뉴 목록 조회 (전체)
 * @param {object} page - Page 인스턴스
 * @param {object} params - 파라미터
 * @returns {Promise<any>} - 메뉴 목록
 */
async function getAllMenuList(page, params) {
    if (!params.patstoNo) {
        return { success: false, error: 'patstoNo is required' };
    }
    const menuList = await getMenuList(page, params);
    const optionList = await getOptionList(page, params);
    return { menuList, optionList };
}

/**
 * 메뉴 상태 변경
 * @param {object} page - Page 인스턴스
 * @param {object} params - 파라미터
 * @returns {Promise<any>} - 메뉴 상태 변경 결과
 */
async function updateMenus(page, params) {
    if (!Array.isArray(params.menuList) || params.menuList.length === 0) {
        return [{ success: true, message: 'menuList is empty' }];
    }

    const updateMenusUrl = process.env.DG_CHANGE_STATUS_MENU;

    let response = [];
    for (const menu of params.menuList) {
        const data = {
            dma_req: {
                menu_id: menu.menu_id,
                menu_grp_nm: menu.menu_grp_nm,
                menu_nm: menu.menu_nm,
                patsto_no: params.patstoNo,
                fin_chg_id: params.patstoMbrId,
                sldot_yn: params.status,
                hide_yn: '',
                pckg_hide_yn: '',
                sto_hide_yn: '',
            }
        }

        const update = await common.api(page, 'POST', updateMenusUrl, { data });

        const result = {success: update?.dma_error?.result === 'SUCCESS', ...update};
        response.push(result);
    }

    common.log(`updateMenus: ${JSON.stringify(response)}`);
    return response;
}

/**
 * 옵션 상태 변경
 * @param {object} page - Page 인스턴스
 * @param {object} params - 파라미터
 * @returns {Promise<any>} - 옵션 상태 변경 결과
 */
async function updateOptions(page, params) {
    if (!Array.isArray(params.optionList) || params.optionList.length === 0) {
        return [{ success: true, message: 'optionList is empty' }];
    }

    const updateOptionsUrl = process.env.DG_CHANGE_STATUS_OPTION;

    let response = [];
    for (const option of params.optionList) {
        const data = {
            dma_req: {
                optn_grp_id: option.optn_grp_id,
                optn_grp_nm: option.optn_grp_nm,
                optn_nm: option.optn_nm,
                optn_id: option.optn_id,
                patsto_no: params.patstoNo,
                fin_chg_id: params.patstoMbrId,
                sldot_yn: params.status,
                hide_yn: '',
                optn_sell_stat_cd: '',
            },
        }

        const update = await common.api(page, 'POST', updateOptionsUrl, { data });

        const result = {success: update?.dma_error?.result === 'SUCCESS', ...update};
        response.push(result);
    }

    common.log(`updateOptions: ${JSON.stringify(response)}`);
    return response;
}

/**
 * 메뉴 및 옵션 품절
 * @param {object} page - Page 인스턴스
 * @param {object} params - 파라미터
 * @returns {Promise<any>} - 품절 결과
 */
async function soldout(page, params) {
    const data = {
        patstoNo: params.patstoNo,
        patstoMbrId: params.patstoMbrId,
        menuList: params.menuList,
        optionList: params.optionList,
        status: '1',
    };

    const updateMenusResult = await updateMenus(page, data);
    const updateOptionsResult = await updateOptions(page, data);
    const response = {
        success: updateMenusResult.every(menu => menu.success) && updateOptionsResult.every(option => option.success),
        failcount: updateMenusResult.filter(menu => !menu.success).length + updateOptionsResult.filter(option => !option.success).length,
        updateMenusResult,
        updateOptionsResult
    };

    common.log(`soldout: ${JSON.stringify(response)}`);
    return response;
}

/**
 * 메뉴 및 옵션 활성화
 * @param {object} page - Page 인스턴스
 * @param {object} params - 파라미터
 * @returns {Promise<any>} - 활성화 결과
 */
async function active(page, params) {
    const data = {
        patstoNo: params.patstoNo,
        patstoMbrId: params.patstoMbrId,
        menuList: params.menuList,
        optionList: params.optionList,
        status: '0',
    };

    const updateMenusResult = await updateMenus(page, data);
    const updateOptionsResult = await updateOptions(page, data);
    const response = {
        success: updateMenusResult.every(menu => menu.success) && updateOptionsResult.every(option => option.success),
        failcount: updateMenusResult.filter(menu => !menu.success).length + updateOptionsResult.filter(option => !option.success).length,
        updateMenusResult,
        updateOptionsResult
    };

    common.log(`active: ${JSON.stringify(response)}`);
    return response;
}

/**
 * 임시중지
 * @param {object} page - Page 인스턴스
 * @param {object} params - 파라미터
 * @returns {Promise<any>} - 임시중지 정보
 */
async function temporaryStop(page, params) {
    const temporaryStopUrl = process.env.DG_TEMPORARY_STOP_URL;

    params.to = params.to?.replace(/[^0-9]/g, '');

    if (params?.to?.length !== 14) {
        if (params?.to?.length === 12) {
            params.to = params.to + '00';
        }
    }

    const data = {
        dlt_req: [
            {
                "patsto_no": params.patstoNo,
                "patsto_biz_stat_cd": params.to ? '03' : '01',
                "patsto_biz_stop_rsn_cd": params.to ? '01' : "00",
                "delv_ord_posb_yn": params.to ? '0' : '1',
                "pckg_ord_posb_yn": params.to ? '0' : '1',
                "sto_ord_posb_yn": params.to ? '0' : '1',
                "fin_chg_id": params.finChgId,
                "patsto_biz_stop_time": params.to || "",
                "rowStatus": "C"
            }
        ]
    };
    const response = await common.api(page, 'POST', temporaryStopUrl, { data });
    common.log(`temporaryStop: ${JSON.stringify(response)}`);
    return response;
}

module.exports = {
    login,
    getShopInfo,
    getAllMenuList,
    getMenuList,
    getOptionList,
    soldout,
    active,
    temporaryStop,
}; 