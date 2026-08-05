function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const isUploadSizeError = error?.code === "LIMIT_FILE_SIZE";
  const statusCode = isUploadSizeError ? 413 : (error.statusCode || 500);
  const payload = {
    success: false,
    message: isUploadSizeError ? "上传文件超过服务限制" : (error.message || "服务内部错误"),
    requestId: req.requestId
  };

  if (error.details) {
    payload.details = error.details;
  }

  if (process.env.NODE_ENV !== "production" && error.stack) {
    payload.stack = error.stack;
  }

  res.status(statusCode).json(payload);
}

module.exports = errorHandler;
