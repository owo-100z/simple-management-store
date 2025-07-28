function wrapAsyncRoutes(router) {
  const methods = ['get', 'post', 'put', 'delete', 'patch'];

  methods.forEach((method) => {
    const original = router[method];
    router[method] = function (path, ...handlers) {
      const wrappedHandlers = handlers.map(handler => {
        if (typeof handler !== 'function' || handler.length !== 3) {
          return handler;  // 일반 미들웨어나 에러 핸들러는 건드리지 않음
        }
        // 비동기 핸들러 감싸기
        return async function (req, res, next) {
          try {
            await handler(req, res, next);
          } catch (err) {
            next(err);  // errorHandler로 전달
          }
        };
      });
      return original.call(router, path, ...wrappedHandlers);
    };
  });

  return router;
}

module.exports = wrapAsyncRoutes;