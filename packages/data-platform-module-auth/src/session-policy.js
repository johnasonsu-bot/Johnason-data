function createSessionPolicy({ enforceConcurrentLimit } = {}) {
  return Object.freeze({
    enforceConcurrentLimit: typeof enforceConcurrentLimit === "function" ? enforceConcurrentLimit : async () => {},
  });
}

module.exports = { createSessionPolicy };
