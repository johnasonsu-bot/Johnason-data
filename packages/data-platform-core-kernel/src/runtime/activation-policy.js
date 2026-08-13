const { policyError } = require("./authorization-policy");

function createActivationPolicy({ active = true } = {}) {
  function requireActive() {
    if (!active) throw policyError("系统尚未激活", "ACTIVATION_REQUIRED", 403);
    return true;
  }
  return Object.freeze({ requireActive });
}

module.exports = { createActivationPolicy };
