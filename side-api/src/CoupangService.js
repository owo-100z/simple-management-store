const { parse } = require('dotenv');
const common = require('./common');

/**
 * 로그인
 * @param {object} page - Page 인스턴스
 * @param {string} username - 로그인 아이디
 * @param {string} password - 로그인 비밀번호
 */
async function login(page, username, password) {
    const loginUrl = process.env.CP_LOGIN_URL;
    try {
        await common.goto(page, loginUrl);
        await page.type('#loginId', username);
        await page.type('#password', password);
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        
        return { success: true };
    } catch (e) {
        console.log(e);
        return { success: false, error: e.message };
    }
}

/**
 * 상점 정보 조회
 * @param {object} page - Page 인스턴스
 * @returns {Promise<any>} - 상점 정보
 */
async function getShopInfo(page) {
    const shopInfoUrl = process.env.CP_SHOP_INFO_URL;
    const shopInfo = await common.api(page, 'GET', shopInfoUrl);
    console.log(`getShopInfo: ${JSON.stringify(shopInfo)}`);

    if (!shopInfo.data || shopInfo.data.length === 0) {
        return { success: false, error: shopInfo.error || 'No shop information found' };
    }

    const response = {...shopInfo.data[0]};
    return response;
}

/**
 * 메뉴 목록 조회 (페이지별)
 * @param {object} page - Page 인스턴스
 * @param {object} params - 파라미터
 * @returns {Promise<any>} - 메뉴 목록
 */
async function getMenuList(page, params) {
    const menuListUrl = process.env.CP_SHOP_INFO_URL + params.shopId + process.env.CP_GET_MENU_LIST_URL;
    const menus = await common.api(page, 'GET', menuListUrl);
    console.log(`getMenuList: ${JSON.stringify(menus)}`);

    const response = menus?.data?.menus?.reduce((acc, menu) => {
        if (menu?.dishes && menu?.dishes?.length > 0) {
            menu.dishes.forEach(dish => {
                if (dish.displayStatus !== 'NOT_EXPOSE') {
                    acc.push({
                        ...dish,
                        menuId: menu.menuId,
                        menuName: menu.menuName,
                    });
                }
            });
        }
        return acc;
    }, []);
    return response;
}

/**
 * 옵션 목록 조회
 * @param {object} page - Page 인스턴스
 * @param {object} params - 파라미터
 * @returns {Promise<any>} - 옵션 목록
 */
async function getOptionList(page, params) {
    const optionListUrl = process.env.CP_SHOP_INFO_URL + params.shopId + process.env.CP_GET_OPTION_URL;
    const options = await common.api(page, 'GET', optionListUrl);

    console.log(`getOptionList: ${JSON.stringify(options)}`);
    
    const response = options?.data?.reduce((acc, group) => {
        if (group?.optionItems && group?.optionItems?.length > 0) {
            group.optionItems.forEach(option => {
                if (option.displayStatus !== 'NOT_EXPOSE') {
                    acc.push({
                        ...option,
                        groupId: group.optionId,
                        groupName: group.optionName,
                    });
                }
            });
        }
        return acc;
    }, []);
    return response;
}

/**
 * 메뉴 목록 조회 (전체)
 * @param {object} page - Page 인스턴스
 * @param {object} params - 파라미터
 * @returns {Promise<any>} - 메뉴 목록
 */
async function getAllMenuList(page, params) {
    if (!params.shopId) {
        return { success: false, error: 'shopId is required' };
    }
    const menuList = await getMenuList(page, params);
    const optionList = await getOptionList(page, params);
    return { menuList: menuList, optionList: optionList };
}

/**
 * 메뉴 상태 변경
 * @param {object} page - Page 인스턴스
 * @param {object} params - 파라미터
 * @returns {Promise<any>} - 메뉴 상태 변경 결과
 */
async function updateMenus(page, params) {
    if (!Array.isArray(params.menuIds) || params.menuIds.length === 0) {
        return { success: true, message: 'menuIds is empty' };
    }

    const updateMenusUrl = process.env.CP_UPDATE_STATUS_URL + params.shopId + process.env.CP_CHANGE_STATUS_MENU;

    const data = params.menuIds.map(menuId => ({
        dishId: menuId,
        displayStatus: params.status
    }));

    const update = await common.api(page, 'POST', updateMenusUrl, data);
    console.log(`updateMenus: ${JSON.stringify(update)}`);

    const response = {success: update.code === 'SUCCESS', ...update};
    return response;
}

/**
 * 옵션 상태 변경
 * @param {object} page - Page 인스턴스
 * @param {object} params - 파라미터
 * @returns {Promise<any>} - 옵션 상태 변경 결과
 */
async function updateOptions(page, params) {
    if (!Array.isArray(params.optionIds) || params.optionIds.length === 0) {
        return { success: true, message: 'optionIds is empty' };
    }

    const updateOptionsUrl = process.env.CP_UPDATE_STATUS_URL + params.shopId + process.env.CP_CHANGE_STATUS_OPTION;

    const data = params.optionIds.map(optionId => ({
        optionItemId: optionId,
        displayStatus: params.status
    }));

    const update = await common.api(page, 'POST', updateOptionsUrl, { data });
    console.log(`updateOptions: ${JSON.stringify(update)}`);

    const response = {success: update.code === 'SUCCESS', ...update};
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
        shopId: params.shopId,
        menuIds: params.menuIds,
        optionIds: params.optionIds,
        status: 'SOLD_OUT_TODAY',
    };

    const updateMenusResult = await updateMenus(page, data);
    const updateOptionsResult = await updateOptions(page, data);
    const response = {
        success: updateMenusResult.success && updateOptionsResult.success,
        updateMenusResult,
        updateOptionsResult
    };

    console.log(`soldout: ${JSON.stringify(response)}`);
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
        shopId: params.shopId,
        menuIds: params.menuIds,
        optionIds: params.optionIds,
        status: 'ON_SALE',
    };

    const updateMenusResult = await updateMenus(page, data);
    const updateOptionsResult = await updateOptions(page, data);
    const response = {
        success: updateMenusResult.success && updateOptionsResult.success,
        updateMenusResult,
        updateOptionsResult
    };

    console.log(`active: ${JSON.stringify(response)}`);
    return response;
}

/**
 * 임시휴무일 설정
 * @param {object} page - Page 인스턴스
 * @param {object} params - 파라미터
 * @returns {Promise<any>} - 임시휴무일 설정 결과
 */
async function irregularHolidays(page, params) {
    const irregularHolidaysUrl = process.env.CP_SHOP_INFO_URL + params.shopId + process.env.CP_IRREGULAR_HOLIDAYS;

    if (!params.from) {
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hour = now.getHours().toString().padStart(2, '0');
        console.log(`Setting from date to current time: ${year}-${month}-${day} ${hour}:00:00`);
        params.from = `${year}${month}${day}${hour}0000`;
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
        }
    } else {
        params.from = setDateFormat(params.from);
    }

    if (params?.to?.length !== 14) {
        if (params?.to?.length === 12) {
            params.to = setDateFormat(params.to + '00');
        }
    } else {
        params.to = setDateFormat(params.to);
    }

    const from = params.from;
    const to = params.to;

    const irregularHolidayDto = from && to ? { id: -1
        , fromYear: from.year, fromMonth: from.month, fromDay: from.day, fromHour: from.hour, fromMinute: from.minute
        , toYear: to.year, toMonth: to.month, toDay: to.day, toHour: to.hour, toMinute: to.minute } : null;

    console.log(`irregularHolidayDto: ${JSON.stringify(irregularHolidayDto)}`);

    const data = {
        irregularHolidayDtoList: irregularHolidayDto ? [irregularHolidayDto] : [],
    }

    const response = await common.api(page, 'POST', irregularHolidaysUrl, { data });
    console.log(`irregularHolidays: ${JSON.stringify(response)}`);
    return response;
}

/**
 * 날짜 형식 설정
 * @param {string} date - 날짜 문자열 (예: "20231001120000")
 * @returns {string} - "YYYY-MM-DD HH:mm" 형식의 날짜
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
    
    return { year, month, day, hour, minute };
}

module.exports = {
    login,
    getShopInfo,
    getAllMenuList,
    getMenuList,
    getOptionList,
    soldout,
    active,
    irregularHolidays,
}; 