import * as echarts from "echarts";
import wordCloudCustomSeriesInstaller from "@echarts-x/custom-word-cloud";
export { normalizeWordCloudOption } from "./echarts-word-cloud-normalizer";

let installed = false;

export function installEchartsWordCloud() {
  if (installed) return;
  echarts.use(wordCloudCustomSeriesInstaller);
  installed = true;
}
