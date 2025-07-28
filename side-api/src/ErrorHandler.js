module.exports = (err, req, res, next) => {
  console.error('🔴 에러 발생:', err.stack || err.message || err);
  
  res.status(500).json({
    error: '서버 내부 오류 발생',
    message: err.message,
  });
};