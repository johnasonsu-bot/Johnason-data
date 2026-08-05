const assert = require("node:assert/strict");
const test = require("node:test");
const service = require("./data-standards.excel.service");

function emptyExisting() {
  return {
    catalogs: new Map(),
    references: new Map(),
    domains: new Map(),
    items: new Map(),
    elements: new Map(),
    identifiers: new Map(),
  };
}

test("bundle template contains a valid linked sample", () => {
  const buffer = service.buildWorkbook("bundle");
  const parsed = service.__test__.normalizeParsed(service.__test__.parseWorkbook(buffer));
  const errors = service.__test__.validateEntries(parsed, emptyExisting(), "merge");

  assert.deepEqual(
    Object.fromEntries(Object.entries(parsed).map(([key, rows]) => [key, rows.length])),
    { catalogs: 1, references: 1, domains: 1, items: 1, elements: 1 },
  );
  assert.equal(errors.length, 0);
  assert.equal(parsed.elements[0].payload.valueDomainCode, parsed.domains[0].payload.domainCode);
});

test("import strategies have explicit duplicate semantics", () => {
  assert.equal(service.__test__.decideAction("append", null), "create");
  assert.equal(service.__test__.decideAction("append", { id: 1 }), "error");
  assert.equal(service.__test__.decideAction("update", null), "error");
  assert.equal(service.__test__.decideAction("update", { id: 1 }), "update");
  assert.equal(service.__test__.decideAction("merge", null), "create");
  assert.equal(service.__test__.decideAction("overwrite", { id: 1 }), "update");
});

test("catalog validation rejects indirect parent cycles", () => {
  const parsed = service.__test__.normalizeParsed(service.__test__.parseWorkbook(service.buildWorkbook("bundle")));
  const first = parsed.catalogs[0];
  parsed.catalogs.push({
    ...first,
    rowNumber: first.rowNumber + 1,
    code: "CAT-B",
    payload: { ...first.payload, catalogCode: "CAT-B", catalogName: "目录 B", parentCode: first.code },
  });
  first.payload.parentCode = "CAT-B";

  const errors = service.__test__.validateEntries(parsed, emptyExisting(), "merge");
  assert.ok(errors.some((item) => item.errorMessage === "目录层级存在循环引用"));
});
