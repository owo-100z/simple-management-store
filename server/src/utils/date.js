/**
 * "YYYYMMDDHHmmss" → "YYYY-MM-DD HH:mm:ss"
 * 배민/쿠팡 임시중지에 사용
 */
function toDateTimeString(date) {
  date = date?.replace(/[^0-9]/g, '');
  if (!date) return null;

  // 12자리면 초 없는 것으로 간주 → 00 추가
  if (date.length === 12) date = date + '00';
  if (date.length !== 14) return null;

  const year   = date.substring(0, 4);
  const month  = date.substring(4, 6);
  const day    = date.substring(6, 8);
  const hour   = date.substring(8, 10);
  const minute = date.substring(10, 12);
  const second = date.substring(12, 14);

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * "YYYYMMDDHHmmss" → { year, month, day, hour, minute }
 * 쿠팡 임시휴무일에 사용
 */
function toDateParts(date) {
  date = date?.replace(/[^0-9]/g, '');
  if (!date) return null;
  if (date.length === 12) date = date + '00';
  if (date.length !== 14) return null;

  return {
    year:   date.substring(0, 4),
    month:  date.substring(4, 6),
    day:    date.substring(6, 8),
    hour:   date.substring(8, 10),
    minute: date.substring(10, 12),
  };
}

/**
 * "YYYYMMDDHHmm" → "YYYY-MM-DD HH:mm"
 * 요기요 임시중지에 사용
 */
function toDateTimeShort(date) {
  date = date?.replace(/[^0-9]/g, '');
  if (!date || date.length !== 12) return null;

  const year   = date.substring(0, 4);
  const month  = date.substring(4, 6);
  const day    = date.substring(6, 8);
  const hour   = date.substring(8, 10);
  const minute = date.substring(10, 12);

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/**
 * 현재 시간을 "YYYYMMDDHHmmss" 형식으로 반환
 */
function nowString() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

module.exports = { toDateTimeString, toDateParts, toDateTimeShort, nowString };
