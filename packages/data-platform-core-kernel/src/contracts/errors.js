class PlatformError extends Error {
  constructor(code, message, details, options) {
    super(message, options);
    this.name = "PlatformError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

module.exports = { PlatformError };
