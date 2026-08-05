const assert = require("node:assert/strict");
const test = require("node:test");
const service = require("./quality-control.service");

const columns = [
  { columnName: "dictionary_type", columnComment: "字典类型" },
  { columnName: "dictionary_name", columnComment: "字典名称" },
  { columnName: "item_code", columnComment: "字典项编码" },
  { columnName: "item_value", columnComment: "字典项值" },
  { columnName: "item_name", columnComment: "字典项名称" },
];

test("联合字典字段映射必须来自真实字段", () => {
  const mapping = service.__test.normalizeDictionaryAnalysisMapping({
    tableMode: "combined",
    dictionaryTypeField: "dictionary_type",
    dictionaryNameField: "dictionary_name",
    itemCodeField: "item_code",
    itemValueField: "item_value",
    itemLabelField: "item_name",
  }, columns);
  assert.equal(mapping.tableMode, "combined");
  assert.equal(mapping.dictionaryTypeField, "dictionary_type");
  assert.equal(mapping.itemLabelField, "item_name");

  assert.throws(() => service.__test.normalizeDictionaryAnalysisMapping({
    tableMode: "combined",
    dictionaryTypeField: "missing_type",
    itemCodeField: "item_code",
  }, columns), /字段 missing_type 不存在/);
});

test("单一字典缺少值和名称字段时回退到编码字段", () => {
  const mapping = service.__test.normalizeDictionaryAnalysisMapping({
    tableMode: "single",
    itemCodeField: "item_code",
  }, columns);
  assert.equal(mapping.itemValueField, "item_code");
  assert.equal(mapping.itemLabelField, "item_code");
});

test("联合字典必须配置字典类型字段", () => {
  assert.throws(() => service.__test.normalizeDictionaryAnalysisMapping({
    tableMode: "combined",
    itemCodeField: "item_code",
  }, columns), /必须识别字典类型字段/);
});

test("字典编码归一化并生成稳定的批次内唯一编码", () => {
  assert.equal(service.__test.buildDictionaryCode("Order Status"), "order_status");
  assert.equal(service.__test.buildDictionaryCode("中文", "ods_dictionary_1"), "ods_dictionary_1");
  const used = new Set(["order_status"]);
  assert.equal(service.__test.ensureUniqueDictionaryCode("order_status", used), "order_status_2");
  assert.equal(service.__test.ensureUniqueDictionaryCode("order_status", used), "order_status_3");
});

test("创建字典时复用同项目下已删除的相同编码", () => {
  const deleted = { id: 28, dictCode: "gov012_02", status: "deleted" };
  assert.equal(service.__test.resolveDictionarySaveExisting(null, deleted, deleted.dictCode), deleted);
});

test("创建字典时仍拒绝占用中的相同编码", () => {
  const active = { id: 28, dictCode: "gov012_02", status: "active" };
  assert.throws(
    () => service.__test.resolveDictionarySaveExisting(null, active, active.dictCode),
    /业务字典表编码 gov012_02 已存在/
  );
});
