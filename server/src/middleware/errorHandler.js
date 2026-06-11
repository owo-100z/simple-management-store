const errorHandler = (err, req, res, next) => {
  console.error('[Error]', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  // puppeteer 관련 에러
  if (err.message?.includes('Target closed') || 
      err.message?.includes('Session closed') ||
      err.message?.includes('Protocol error')) {
    return res.status(503).json({
      success: false,
      code: 'BROWSER_ERROR',
      message: '브라우저 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    });
  }

  // 로그인 필요
  if (err.message?.includes('LOGIN_REQUIRED')) {
    return res.status(401).json({
      success: false,
      code: 'LOGIN_REQUIRED',
      message: err.message,
    });
  }

  // 타임아웃
  if (err.message?.includes('timeout') || 
      err.message?.includes('Timeout')) {
    return res.status(408).json({
      success: false,
      code: 'TIMEOUT',
      message: '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
    });
  }

  // 그 외 에러
  return res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: err.message || '서버 내부 오류가 발생했습니다.',
  });
};

module.exports = errorHandler;