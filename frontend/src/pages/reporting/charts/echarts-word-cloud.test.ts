import { describe, expect, it } from "vitest";
import { normalizeWordCloudOption } from "./echarts-word-cloud-normalizer";

describe("normalizeWordCloudOption", () => {
  it("converts legacy wordCloud series to the ECharts 6 custom series contract", () => {
    const input = {
      tooltip: { show: true },
      series: [{
        type: "wordCloud",
        shape: "diamond",
        gridSize: 12,
        sizeRange: [14, 48],
        rotationRange: [-45, 45],
        rotationStep: 45,
        data: [{ name: "广州", value: 20, textStyle: { color: "#1677ff" } }],
      }],
    };

    expect(normalizeWordCloudOption(input)).toEqual({
      tooltip: { show: true },
      series: [{
        type: "custom",
        renderItem: "wordCloud",
        itemPayload: {
          shape: "diamond",
          gridSize: 12,
          sizeRange: [14, 48],
          rotationRange: [-45, 45],
          rotationStep: 45,
        },
        data: [{ value: ["广州", 20], itemStyle: { color: "#1677ff" } }],
      }],
    });
  });

  it("leaves ordinary series unchanged", () => {
    const input = { series: [{ type: "bar", data: [1, 2, 3] }] };
    expect(normalizeWordCloudOption(input)).toEqual(input);
  });

  it("does not convert an already normalized custom word cloud twice", () => {
    const input = {
      series: [{ type: "custom", renderItem: "wordCloud", itemPayload: { shape: "circle" }, data: [["CZ", 10]] }],
    };
    expect(normalizeWordCloudOption(input)).toEqual(input);
  });
});
