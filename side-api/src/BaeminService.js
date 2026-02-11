const common = require('./common');
const { createCursor, GhostCursor } = require('ghost-cursor');

// 공통 API 호출 함수
async function api(page, method, url, options = {}) {
    return await common.api(page, method, url, {
        headers: {'service-channel': 'SELF_SERVICE_PC',},
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
    const loginUrl = process.env.BM_LOGIN_URL;
    const cursor = new GhostCursor(page);

    try {
        await common.goto(page, loginUrl);
        await page.type('input[name="id"]', username, { delay: Math.random() * 200 + 100 });
        await page.type('input[name="password"]', password, { delay: Math.random() * 200 + 100 });
        await cursor.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        await page.goto(process.env.BM_URL);
        
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
    const ownerInfoUrl = process.env.BM_OWNER_INFO_URL;
    
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
    const ownerInfo = await getOwnerInfo(page);
    const shopInfoUrl = process.env.BM_SHOP_INFO_URL;

    if (!ownerInfo || !ownerInfo.shopOwnerNumber) {
        return { success: false, error: ownerInfo.errorMessage || 'Owner information not found' };
    }

    const data = {
        shopOwnerNo: ownerInfo?.shopOwnerNumber,
    }

    const response = await api(page, 'GET', shopInfoUrl, { data });
    common.log(`getShopInfo: ${JSON.stringify(response)}`);

    if (!response?.content || response?.content.length === 0) {
        return { success: false, error: response.errorMessage || 'No shop information found' };
    }

    return {...ownerInfo, ...response.content[0]};
}

/**
 * 메뉴 조회
 * @param {object} page - Page 인스턴스
 * @param {object} params - 조회 파라미터
 * @returns {Promise<any>} - 메뉴 정보
 */
async function getMenuList(page, params) {
    const menuListUrl = process.env.BM_OWNER_URL_V2 + params.shopOwnerNumber + process.env.BM_GET_MENU_LIST_URL;

    common.log(`menuListUrl: ${menuListUrl}`);

    const data = {
        shopId: params.shopNo,
        menuName: params.menuName,
        page: params?.menuName ? 0 : params?.page,
        size: 20,
    };

    common.log(`request menu data: ${JSON.stringify(data)}`);

    const response = await api(page, 'GET', menuListUrl, { data });
    common.log(`getMenuList: ${JSON.stringify(response)}`);

    if (!response.data) return [];

    response.data.content = response.data?.content?.filter(menu => menu.menuStatusResponse?.status !== 'HIDE');
    return response;
}

/**
 * 옵션 조회
 * @param {object} page - Page 인스턴스
 * @param {object} params - 조회 파라미터
 * @returns {Promise<any>} - 옵션 정보
 */
async function getOptionList(page, params) {
    const optionListUrl = process.env.BM_OWNER_URL_V1 + params.shopOwnerNumber + process.env.BM_GET_OPTION_LIST_URL;

    common.log(`optionListUrl: ${optionListUrl}`);

    const data = {
        optionName: params.optionName,
        page: params?.optionName ? 0 : params?.page,
        size: 20,
    };

    common.log(`request option data: ${JSON.stringify(data)}`);

    const option = await api(page, 'GET', optionListUrl, { data });
    common.log(`getOptionList: ${JSON.stringify(option)}`);

    const response = option.data.content.reduce((acc, group) => {
        if (group.options && group.options.length > 0) {
            group.options.forEach(option => {
                if (option.itemStatus !== 'HIDE') {
                    acc.push({
                        ...option,
                        groupName: group.name,
                        groupId: group.id,
                    });
                }
            });
        }
        return acc;
    }, []);
    return response;
}

/**
 * 모든 메뉴 및 옵션 조회
 * @param {object} page - Page 인스턴스
 * @param {object} params - 조회 파라미터
 * @returns {Promise<any>} - 메뉴 및 옵션 정보
 */
async function getAllMenuList(page, params) {
    let menuList = [];
    let optionList = [];
    let pageNo = 0;
    let last = false;

    common.log(`getAllMenuList: ${params.shopNo}, ${params.shopOwnerNumber}`);

    while (!last) {
        const menuResponse = await getMenuList(page, { shopNo: params.shopNo, page: pageNo, shopOwnerNumber: params.shopOwnerNumber });
        menuList = [...menuList, ...menuResponse.data.content];
        pageNo++;
        last = menuResponse.data.last;
    }

    pageNo = 0;   // 옵션은 페이지가 0임
    const optionResponse = await getOptionList(page, { shopNo: params.shopNo, page: pageNo, shopOwnerNumber: params.shopOwnerNumber });
    optionList = [...optionList, ...optionResponse];

    return {
        menuList,
        optionList,
    }
}

/**
 * 메뉴 품절
 * @param {object} page - Page 인스턴스
 * @param {object} params - 품절 처리 파라미터
 * @returns {Promise<any>} - 메뉴 품절 정보
 */
async function soldoutMenu(page, params) {
    const soldoutMenuUrl = process.env.BM_OWNER_URL_V2 + params.shopOwnerNumber + process.env.BM_SOLDOUT_MENU_URL;

    const data = {
        menuIds: params.menuIds,
        restockedAt: params.restockedAt,
    }

    if (!Array.isArray(params.menuIds) || params.menuIds.length === 0) {
        return { success: true, message: 'menuIds is empty' };
    }

    const soldout = await api(page, 'PUT', soldoutMenuUrl, { data });
    common.log(`soldoutMenu: ${JSON.stringify(soldout)}`);

    const response = {success: soldout.code === 200, ...soldout};
    return response;
}

/**
 * 메뉴 활성화
 * @param {object} page - Page 인스턴스
 * @param {object} params - 활성화 처리 파라미터
 * @returns {Promise<any>} - 메뉴 활성화 정보
 */
async function activeMenu(page, params) {
    const activeMenuUrl = process.env.BM_OWNER_URL_V2 + params.shopOwnerNumber + process.env.BM_ACTIVE_MENU_URL;

    const data = {
        menuIds: params.menuIds,
    }

    if (!Array.isArray(params.menuIds) || params.menuIds.length === 0) {
        return { success: true, message: 'menuIds is empty' };
    }

    const release = await api(page, 'PUT', activeMenuUrl, { data });
    common.log(`activeMenu: ${JSON.stringify(release)}`);

    const response = {success: release.code === 200, ...release};
    return response;
}

/**
 * 옵션 품절
 * @param {object} page - Page 인스턴스
 * @param {object} params - 품절 처리 파라미터
 * @returns {Promise<any>} - 옵션 품절 정보
 */
async function soldoutOption(page, params) {
    const soldoutOptionUrl = process.env.BM_OWNER_URL_V2 + params.shopOwnerNumber + process.env.BM_SOLDOUT_OPTION_URL;

    const data = {
        optionIds: params.optionIds,
        restockedAt: params.restockedAt,
    }

    if (!Array.isArray(params.optionIds) || params.optionIds.length === 0) {
        return { success: true, message: 'optionIds is empty' };
    }

    const soldout = await api(page, 'PUT', soldoutOptionUrl, { data });
    common.log(`soldoutOption: ${JSON.stringify(soldout)}`);

    const response = {success: soldout.code === 200, ...soldout};
    return response;
}

/**
 * 옵션 활성화
 * @param {object} page - Page 인스턴스
 * @param {object} params - 활성화 처리 파라미터
 * @returns {Promise<any>} - 옵션 활성화 정보
 */
async function activeOption(page, params) {
    const activeOptionUrl = process.env.BM_OWNER_URL_V2 + params.shopOwnerNumber + process.env.BM_ACTIVE_OPTION_URL;

    const data = {
        optionIds: params.optionIds,
    }

    if (!Array.isArray(params.optionIds) || params.optionIds.length === 0) {
        return { success: true, message: 'optionIds is empty' };
    }

    const release = await api(page, 'PUT', activeOptionUrl, { data });
    common.log(`activeOption: ${JSON.stringify(release)}`);

    const response = {success: release.code === 200, ...release};
    return response;
}

/**
 * 메뉴 및 옵션 품절
 * @param {object} page - Page 인스턴스
 * @param {object} params - 품절 처리 파라미터
 * @returns {Promise<any>} - 메뉴 및 옵션 품절 정보
 */
async function soldout(page, params) {
    const soldoutMenuResponse = await soldoutMenu(page, { menuIds: params.menuIds, restockedAt: params.restockedAt, shopOwnerNumber: params.shopOwnerNumber });
    const soldoutOptionResponse = await soldoutOption(page, { optionIds: params.optionIds, restockedAt: params.restockedAt, shopOwnerNumber: params.shopOwnerNumber });

    return {
        success: soldoutMenuResponse.success && soldoutOptionResponse.success,
        soldoutMenuResponse,
        soldoutOptionResponse,
    }
}

/**
 * 메뉴 및 옵션 활성화
 * @param {object} page - Page 인스턴스
 * @param {object} params - 활성화 처리 파라미터
 * @returns {Promise<any>} - 메뉴 및 옵션 활성화 정보
 */
async function active(page, params) {
    const activeMenuResponse = await activeMenu(page, { menuIds: params.menuIds, shopOwnerNumber: params.shopOwnerNumber });
    const activeOptionResponse = await activeOption(page, { optionIds: params.optionIds, shopOwnerNumber: params.shopOwnerNumber });

    return {
        success: activeMenuResponse.success && activeOptionResponse.success,
        activeMenuResponse,
        activeOptionResponse,
    }
}

/**
 * 임시중지
 * @param {object} page - Page 인스턴스
 * @param {object} params - 임시중지 처리 파라미터
 * @returns {Promise<any>} - 임시중지 정보
 */
async function temporaryStop(page, params) {
    const temporaryStopUrl = process.env.BM_TEMPORARY_STOP_URL;

    if (!params.from) {
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hour = now.getHours().toString().padStart(2, '0');
        params.from = `${year}${month}${day}${hour}0000`;
        common.log(`Setting from date to current time: ${year}-${month}-${day} ${hour}:00:00`);
    } else {
        params.from = params.from?.replace(/[^0-9]/g, '');
    }
    params.to = params.to?.replace(/[^0-9]/g, '');

    if (params.from && params.to && params.from > params.to) {
        return { success: false, error: 'From date cannot be later than To date' };
    }

    if (params?.from?.length !== 14) {
        if (params?.from?.length === 12) {
            params.from = setDateFormat(params.from + '00');
        } else {
            return { success: false, message: 'Invalid from date format. Use "YYYYMMDDHHmmss"' };
        }
    } else {
        params.from = setDateFormat(params.from);
    }

    if (params?.to?.length !== 14) {
        if (params?.to?.length === 12) {
            params.to = setDateFormat(params.to + '00');
        } else {
            return { success: false, message: 'Invalid to date format. Use "YYYYMMDDHHmmss"' };
        }
    } else {
        params.to = setDateFormat(params.to);
    }

    const data = {
        reason: 'PERSONAL_REASON',
        temporaryStops: [
            {deliveryType: "OWN_DELIVERY", startDate: params.from, endDate: params.to},
            {deliveryType: "AGENCY_DELIVERY", startDate: params.from, endDate: params.to},
            {deliveryType: "VISIT", startDate: params.from, endDate: params.to},
        ]
    };

    const response = await api(page, 'PUT', temporaryStopUrl, { data });
    common.log(`temporaryStop: ${JSON.stringify(response)}`);
    return response;
}

/**
 * 임시중지 해제
 * @param {object} page - Page 인스턴스
 * @param {object} params - 해제 처리 파라미터
 * @returns {Promise<any>} - 임시중지 해제 정보
 */
async function releaseStop (page, params) {
    const releaseStopUrl = process.env.BM_TEMPORARY_STOP_URL;

    const response = await api(page, 'DELETE', releaseStopUrl);
    common.log(`releaseStop: ${JSON.stringify(response)}`);
    return response;
}

/**
 * 날짜 형식 설정
 * @param {string} date - 날짜 문자열 (예: "20231001120000")
 * @returns {string} - "YYYY-MM-DD HH:mm:ss" 형식의 날짜
 */
function setDateFormat (date) {
    if (!date || date.length !== 14) {
        return null;
    }
    const year = date.substring(0, 4);
    const month = date.substring(4, 6);
    const day = date.substring(6, 8);
    const hour = date.substring(8, 10);
    const minute = date.substring(10, 12);
    const second = date.substring(12, 14);
    
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

const baeminService = {
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

module.exports = baeminService;