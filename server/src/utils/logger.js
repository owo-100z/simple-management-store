const fs = require('fs').promises;
const path = require('path');

/**
 * 타임스탬프 생성
 */
function getTimestamp() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${now.getMilliseconds()}`;
}

/**
 * 호출한 파일명 추출
 */
function getCallerFile() {
  try {
    const stack = new Error().stack;
    if (!stack) return 'unknown';
    const lines = stack.split('\n');
    const callerLine = lines.find(
      (line) => !line.includes(__filename) && line.includes('.js')
    );
    if (callerLine) {
      const match = callerLine.match(/([^/\\]+)\.js/);
      if (match) return match[1];
    }
  } catch {
    // ignore
  }
  return 'unknown';
}

/**
 * 로그 출력
 */
function log(message) {
  const timestamp = getTimestamp();
  const caller = getCallerFile();
  console.log(`[${timestamp}] [${caller}] ${message}`);
}

/**
 * 에러 로그 출력
 */
function error(message) {
  const timestamp = getTimestamp();
  const caller = getCallerFile();
  console.error(`[${timestamp}] [${caller}] ERROR: ${message}`);
}

/**
 * 스크린샷 저장
 */
async function screenshot(page, filename) {
  try {
    const dir = path.join(process.cwd(), 'errImgs');
    await fs.mkdir(dir, { recursive: true });

    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const filepath = path.join(dir, `${filename}-${timestamp}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    log(`Screenshot saved: ${filepath}`);
  } catch (e) {
    error(`Screenshot failed: ${e.message}`);
  }
}

module.exports = { log, error, screenshot };
