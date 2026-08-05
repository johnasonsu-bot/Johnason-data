const assert = require("node:assert/strict");
const test = require("node:test");
const service = require("./quality-control.service");

test("合规规则解析结果归一化为可保存结构", () => {
  const result = service.__test.normalizeRegexRuleAnalysis({
    ruleCode: "Mobile Phone CN",
    regexPattern: "^1[3-9]\\d{9}$",
    matchExamples: ["13800138000", "13800138000", "19912345678"],
    mismatchExamples: ["123", "1380013800", "13800138000"],
    severity: "high",
    reason: "校验中国大陆手机号格式",
  }, "手机号码");

  assert.equal(result.ruleCode, "mobile_phone_cn");
  assert.equal(result.regexPattern, "^1[3-9]\\d{9}$");
  assert.deepEqual(result.matchExamples, ["13800138000", "19912345678"]);
  assert.deepEqual(result.mismatchExamples, ["123", "1380013800"]);
  assert.equal(result.severity, "high");
});

test("无效正则表达式会被拒绝", () => {
  assert.throws(
    () => service.__test.normalizeRegexRuleAnalysis({ ruleCode: "bad_regex", regexPattern: "[" }, "错误规则"),
    /正则表达式无效/
  );
});

test("推荐编码会避开已有规则编码", () => {
  assert.equal(
    service.__test.ensureUniqueRegexRuleCode("mobile_phone_cn", new Set(["mobile_phone_cn", "mobile_phone_cn_2"])),
    "mobile_phone_cn_3"
  );
});
