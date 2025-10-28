// const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const apiBaseUrl = '/api';
// const apiBaseUrl = 'http://localhost:5000/api';

let loadingCnt = 0;

export const comm = {
  timestamp: () => {
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const min = pad(now.getMinutes());
    const sec = pad(now.getSeconds());
    const milisec = pad(now.getMilliseconds());

    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}.${milisec}`;
  },
  log: (...args) => {
    const timestamp = comm.timestamp();
    console.log(`[${timestamp}]: `, ...args);
  },
  error: (...args) => {
    const timestamp = comm.timestamp();
    console.error(`[${timestamp}]: `, ...args);
  },
  api: async (url, { method = 'GET', params, body, headers } = {}) => {
    // 기본 URL 설정
    let fullUrl = apiBaseUrl + url;

    // GET 방식이면 params를 쿼리스트링으로 변환
    if (params && method.toUpperCase() === 'GET') {
      const query = new URLSearchParams(params).toString();
      fullUrl += `?${query}`;
    }

    // comm.log(`API Request: ${method} ${fullUrl}`);
    if (params && method.toUpperCase() === 'GET') comm.log(`Query Parameters: ${JSON.stringify(params)}`);
    if (body && method.toUpperCase() !== 'GET') comm.log(`Request Body: ${JSON.stringify(body)}`);
    if (headers) comm.log(`Request Headers: ${JSON.stringify(headers)}`);

    try {
      if (++loadingCnt > 0) {
        document.getElementById("loading-overlay").classList.remove("hidden");
      }
      const res = await fetch(fullUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: method.toUpperCase() !== 'GET' ? JSON.stringify(body) : undefined,
      });

      const data = await res.json(); // fetch 성공 시 데이터

      return data;
    } catch (e) {
      comm.error(`API Error: ${e}`);
      return { status: 'error', error: e.message };
    } finally {
      if (--loadingCnt === 0) {
        document.getElementById("loading-overlay").classList.add("hidden");
      }
        
    }
  },
}

export const utils = {
  isEmpty: (obj) => {
    if (obj === null || obj === undefined) return true;
    if (typeof obj === "object") {
      return Object.keys(obj).length === 0;
    }
    if (obj.length === 0) return true;
    return false;
  },
  getToday: () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  getDateDaysAgo: (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}