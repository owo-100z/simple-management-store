const { log } = require('./logger');

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24시간

const SERVICES = ['baemin', 'coupang', 'ddangyo', 'yogiyo'];

// 서비스별 캐시 초기 구조 생성
function createInitialCache() {
  return SERVICES.reduce((acc, service) => {
    acc[service] = {
      shopInfo: { data: null, timestamp: null },
      menuList: { data: null, timestamp: null },
    };
    return acc;
  }, {});
}

let cache = createInitialCache();

// 서비스별 fetch 함수 등록소
const fetchFunctions = SERVICES.reduce((acc, service) => {
  acc[service] = {};
  return acc;
}, {});

/**
 * 서비스별 fetch 함수 등록
 */
function setFetchFunctions(service, functions) {
  fetchFunctions[service] = functions;
}

/**
 * 캐시 유효성 검사
 */
function isCacheValid(service, cacheKey) {
  const item = cache[service]?.[cacheKey];
  if (!item?.data || !item?.timestamp) return false;
  return Date.now() - item.timestamp < CACHE_DURATION;
}

/**
 * 여러 캐시 키 모두 유효한지 검사
 */
function areAllCachesValid(service, cacheKeys) {
  return cacheKeys.every((key) => isCacheValid(service, key));
}

/**
 * 캐시에서 데이터만 조회 (fetch 없이)
 * @returns {object|null} 캐시된 데이터 또는 null
 */
function getCacheData(service, cacheKey) {
  const item = cache[service]?.[cacheKey];
  if (!item?.data || !item?.timestamp) return null;
  if (Date.now() - item.timestamp >= CACHE_DURATION) return null;
  return item.data;
}

/**
 * 캐시된 데이터 반환 (없으면 fetch 후 캐시)
 */
async function getCachedData(page, service, cacheKey, params) {
  const item = cache[service][cacheKey];

  if (isCacheValid(service, cacheKey)) {
    // log(`Cache hit: ${service}.${cacheKey}`);
    return item.data;
  }

  // log(`Cache miss: ${service}.${cacheKey} - fetching fresh data`);
  const fetchFn = fetchFunctions[service][cacheKey];
  if (!fetchFn) throw new Error(`fetchFunction not registered: ${service}.${cacheKey}`);

  item.data = await fetchFn(page, params);
  item.timestamp = Date.now();

  return item.data;
}

/**
 * 캐시 초기화
 * @param {string|null} service - null이면 전체 초기화
 */
function initCache(service = null) {
  if (service) {
    cache[service] = {
      shopInfo: { data: null, timestamp: null },
      menuList: { data: null, timestamp: null },
    };
    log(`Cache cleared: ${service}`);
  } else {
    cache = createInitialCache();
    log('Cache cleared: all');
  }
}

module.exports = {
  setFetchFunctions,
  isCacheValid,
  areAllCachesValid,
  getCacheData,
  getCachedData,
  initCache,
};
