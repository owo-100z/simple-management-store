const common = require('./common');

// 공통 API 호출 함수
async function api(page, method, url, options = {}) {
    const _ck = await page.cookies();

    const ACCESS_TOKEN = _ck.find(t => t.name === 'EXT_ACCESS_TOKEN')?.value;

    // common.log(ACCESS_TOKEN);

    return await common.api(page, method, url, {
        headers: {'Authorization': `Bearer ${ACCESS_TOKEN}`},
        ...options,
    });
}

/**
 * 로그인
 * @param {object} page - Page 인스턴스
 * @param {string} username - 로그인 아이디
 * @param {string} password - 로그인 비밀번호
 */
async function login(page, username, password) {
    const loginUrl = process.env.YG_LOGIN_URL;
    try {
        await common.goto(page, loginUrl);
        await page.type('input[name="username"]', username);
        await page.type('input[name="password"]', password);
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        await page.goto(process.env.YG_URL);
        
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * 주인 정보 조회
 * @param {object} page - Page 인스턴스
 * @returns {Promise<any>} - 주인 정보
 */
async function getOwnerInfo(page) {
    const ownerInfoUrl = process.env.YG_OWNER_INFO_URL;
    
    const requestURL = ownerInfoUrl;

    const response = await api(page, 'GET', requestURL);
    common.log(`getOwnerInfo: ${JSON.stringify(response)}`);
    return response;
}

/**
 * 상점 정보 조회
 * @param {object} page - Page 인스턴스
 * @returns {Promise<any>} - 상점 정보
 */
async function getShopInfo(page) {
    // const ownerInfo = await getOwnerInfo(page);
    const shopInfoUrl = process.env.YG_SHOP_INFO_URL;

    // if (!ownerInfo || !ownerInfo.shopOwnerNumber) {
    //     return { success: false, error: ownerInfo.errorMessage || 'Owner information not found' };
    // }

    const response = await api(page, 'GET', shopInfoUrl);
    common.log(`getShopInfo: ${JSON.stringify(response)}`);

    if (!response || response.length === 0) {
        return { success: false, error: response.errorMessage || 'No shop information found' };
    }

    return {...response[0]};
}

/**
 * 메뉴 조회
 * @param {object} page - Page 인스턴스
 * @param {object} params - 조회 파라미터
 * @returns {Promise<any>} - 메뉴 정보
 */
async function getMenuList(page, params) {
    const menuListUrl = process.env.YG_GET_MENU_LIST_URL?.replace('{SHOP_NUMBER}', params.shop_no).replace('{COMPANY_NUMBER}', params.company_number).replace('{SIZE}', params.size);

    common.log(`menuListUrl: ${menuListUrl}`);

    const response = await api(page, 'GET', menuListUrl);
    common.log(`getMenuList: ${JSON.stringify(response)}`);

    let menus = [];

    try {
        menus = response?.data?.reduce((acc, cur) => {
            const availabe_menus = cur.products.filter(t => !t.invisible);
            acc = [...acc, ...availabe_menus];
            return acc
        }, [])
    } catch (e) {
        menus = [];
    }

    return menus;
}

/**
 * 옵션 조회
 * @param {object} page - Page 인스턴스
 * @param {object} params - 조회 파라미터
 * @returns {Promise<any>} - 옵션 정보
 */
async function getOptionList(page, params) {
    const optnListUrl = process.env.YG_GET_OPTION_LIST_URL?.replace('{SHOP_NUMBER}', params.shop_no).replace('{COMPANY_NUMBER}', params.company_number).replace('{SIZE}', params.size);

    common.log(`optionListUrl: ${optnListUrl}`);

    const response = await api(page, 'GET', optnListUrl);
    common.log(`getOptionList: ${JSON.stringify(response)}`);

    let optns = [];

    try {
        optns = response?.data?.reduce((acc, cur) => {
            const availabe_optns = cur.options.filter(t => !t.invisible);
            acc = [...acc, ...availabe_optns];
            return acc
        }, [])
    } catch (e) {
        optns = [];
    }

    return optns;
}

/**
 * 모든 메뉴 및 옵션 조회
 * @param {object} page - Page 인스턴스
 * @param {object} params - 조회 파라미터
 * @returns {Promise<any>} - 메뉴 및 옵션 정보
 */
async function getAllMenuList(page, params) {
    common.log(`getAllMenuList: ${params.shop_no}, ${params.company_number}`);

    const size = 500;

    const menuList = await getMenuList(page, { shop_no: params.shop_no, company_number: params.company_number, size });
    const optionList = await getOptionList(page, { shop_no: params.shop_no, company_number: params.company_number, size });

    return {
        menuList,
        optionList,
    }
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

    const COMPANY_NUMBER = params.company_number;

    let response = [];
    for (const menu of params.menuList) {

        const updateMenusUrl = process.env.YG_CHANGE_STATUS_MENU?.replace('{SHOP_NUMBER}', params.shop_no).replace('{MENU_ID}', menu.product_id);

        let data = {
            "company_number": COMPANY_NUMBER,
        }

        if (params.type === 'soldout') {
            data.invisible = true
        }

        const update = await api(page, 'POST', updateMenusUrl, { data });

        const result = {success: true, ...update};
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

    const COMPANY_NUMBER = params.company_number;

    let response = [];
    for (const option of params.optionList) {
        const updateOptionsUrl = process.env.YG_CHANGE_STATUS_OPTION?.replace('{SHOP_NUMBER}', params.shop_no).replace('{OPTION_ID}', option.option_id);

        const data = {
            "oneday_invisible": params.type === 'soldout' ? "on" : '', // 하루품절
            "longterm_invisible": "", // 숨김
            "company_number": COMPANY_NUMBER
        }

        const update = await api(page, 'PUT', updateOptionsUrl, { data });

        const result = {success: update?.invisible === (params.type === 'soldout'), ...update};
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
        shop_no: params.shop_no,
        company_number: params.company_number,
        menuList: params.menuList,
        optionList: params.optionList,
        type: 'soldout'
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
        shop_no: params.shop_no,
        company_number: params.company_number,
        menuList: params.menuList,
        optionList: params.optionList,
        type: 'release'
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
 * @param {object} params - 임시중지 처리 파라미터
 * @returns {Promise<any>} - 임시중지 정보
 */
async function temporaryStop(page, params) {
    const temporaryStopUrl = process.env.YG_TEMPORARY_STOP_URL?.replace('{SHOP_NUMBER}', params.shop_no);

    params.to = setDateFormat(params.to);

    if (!params.to) {
        return { success: false, message: 'Invalid to date format. Use "YYYYMMDDHHmm"' };
    }

    const data = {
        "order_type": "delivery",
        "apply_related_vendors": false,
        "minutes": null,
        "day": null,
        "end_datetime": params.to
    }

    await api(page, 'POST', temporaryStopUrl, { data });

    const response = await api(page, 'GET', temporaryStopUrl);
    common.log(`temporaryStop: ${JSON.stringify(response)}`);

    const rtn = {
        success: !response?.is_open,
        message: `임시중지가 ${!response?.is_open ? '정상 처리되었습니다' : '실패하였습니다'}`
    }

    return rtn;
}

/**
 * 임시중지 해제
 * @param {object} page - Page 인스턴스
 * @param {object} params - 해제 처리 파라미터
 * @returns {Promise<any>} - 임시중지 해제 정보
 */
async function releaseStop (page, params) {
    const releaseStopUrl = process.env.YG_TEMPORARY_STOP_URL?.replace('{SHOP_NUMBER}', params.shop_no);

    const stopStatus = await api(page, 'GET', releaseStopUrl);

    if (stopStatus?.is_open) {
        return {
            success: true,
            message: '임시중지가 이미 해제되었습니다.'
        };
    }

    const pauseId = stopStatus?.pause?.id;

    if (!pauseId) {
        return {
            success: false,
            message: '해제할 ID를 찾지못했습니다.'
        };
    }

    const deleteUrl = releaseStopUrl + `${pauseId}/?apply_related_vendors=false`;
    await api(page, 'DELETE', deleteUrl);

    const response = await api(page, 'GET', releaseStopUrl);
    common.log(`releaseStop: ${JSON.stringify(response)}`);

    const rtn = {
        success: response?.is_open,
        message: `임시중지 해제가 ${response?.is_open ? '정상 처리되었습니다' : '실패하였습니다'}`
    }

    return rtn;
}

/**
 * 날짜 형식 설정
 * @param {string} date - 날짜 문자열 (예: "20231001120000")
 * @returns {string} - "YYYY-MM-DD HH:mm:ss" 형식의 날짜
 */
function setDateFormat (date) {
    date = date?.replace(/[^0-9]/g, '');
    if (!date || date.length !== 12) {
        return null;
    }
    const year = date.substring(0, 4);
    const month = date.substring(4, 6);
    const day = date.substring(6, 8);
    const hour = date.substring(8, 10);
    const minute = date.substring(10, 12);
    
    return `${year}-${month}-${day} ${hour}:${minute}`;
}

const yogiyoService = {
    login,
    getShopInfo,
    getMenuList,
    getOptionList,
    getAllMenuList,
    soldout,
    active,
    temporaryStop,
    releaseStop,
}

module.exports = yogiyoService;