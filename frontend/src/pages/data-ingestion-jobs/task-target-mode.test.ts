import { describe, expect, it } from "vitest";

import { inferTargetTableMode } from "./task-target-mode";

describe("inferTargetTableMode", () => {
  it("defaults legacy tasks with a target table to existing mode", () => {
    expect(inferTargetTableMode({ targetConfig: { table: ["ods_flight_schedule"] } })).toBe("existing");
  });

  it("honors an explicitly persisted create mode", () => {
    expect(inferTargetTableMode({ targetConfig: { targetTableMode: "create" } })).toBe("create");
  });

  it("honors an explicitly persisted existing mode", () => {
    expect(inferTargetTableMode({ targetConfig: { targetTableMode: "existing" } })).toBe("existing");
  });
});
