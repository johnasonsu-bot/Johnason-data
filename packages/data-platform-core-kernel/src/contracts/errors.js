class DatabaseRuntimeMissingError extends Error {
  constructor() {
    super("A database runtime is required for this operation");
    this.name = "DatabaseRuntimeMissingError";
    this.code = "DATABASE_RUNTIME_MISSING";
  }
}

module.exports = { DatabaseRuntimeMissingError };
