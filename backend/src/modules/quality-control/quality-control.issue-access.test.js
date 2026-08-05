const assert = require("node:assert/strict");
const test = require("node:test");
const { __test } = require("./quality-analytics.service");

test("系统管理员查看质量问题时不追加负责人范围", () => {
  assert.deepEqual(__test.buildIssueAccessScope({ id: 1, roleCode: "admin" }), { clause: null, params: [] });
  assert.deepEqual(__test.buildIssueAccessScope({ id: 2, roleType: "admin" }), { clause: null, params: [] });
});

test("普通用户只能访问分配给自己的质量问题", () => {
  assert.deepEqual(
    __test.buildIssueAccessScope({ id: 27, roleCode: "operator", roleType: "operator" }),
    { clause: "i.owner_user_id=?", params: [27] }
  );
});

test("缺少有效用户身份时不返回质量问题", () => {
  assert.deepEqual(__test.buildIssueAccessScope({ roleCode: "operator" }), { clause: "1=0", params: [] });
});
