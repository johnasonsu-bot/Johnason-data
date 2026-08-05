import { Space, Tag } from "antd";
import type { LabIndustryIncubationRecord } from "../../../types/api";

export const TEMPLATE_STATUS_META: Record<string, { color: string; label: string }> = {
  draft: { color: "default", label: "草稿" },
  active: { color: "processing", label: "启用" },
  archived: { color: "gold", label: "归档" },
};

export const INSTANCE_STATUS_META: Record<string, { color: string; label: string }> = {
  draft: { color: "default", label: "草稿" },
  active: { color: "processing", label: "启用" },
  archived: { color: "gold", label: "归档" },
};

export const DATA_SOURCE_STATUS_META: Record<string, { color: string; label: string }> = {
  draft: { color: "default", label: "草稿" },
  active: { color: "processing", label: "启用" },
  archived: { color: "gold", label: "归档" },
};

export const DATA_SOURCE_THEME_META: Record<string, { color: string; label: string }> = {
  user: { color: "blue", label: "用户身份" },
  merchant: { color: "green", label: "经营主体" },
  activity: { color: "purple", label: "业务活动" },
};

export function renderStatus(value: string, metaMap: Record<string, { color: string; label: string }>) {
  const meta = metaMap[value] || { color: "default", label: value || "-" };
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

export function renderCodeTags(values: string[]) {
  if (!Array.isArray(values) || values.length === 0) return "-";
  return (
    <Space size={[4, 4]} wrap>
      {values.map((item) => (
        <Tag key={item}>{item}</Tag>
      ))}
    </Space>
  );
}

export function renderThemeTags(values: string[]) {
  if (!Array.isArray(values) || values.length === 0) return "-";
  return (
    <Space size={[4, 4]} wrap>
      {values.map((item) => {
        const meta = DATA_SOURCE_THEME_META[item] || { color: "default", label: item };
        return (
          <Tag color={meta.color} key={item}>
            {meta.label}
          </Tag>
        );
      })}
    </Space>
  );
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return String(value).replace("T", " ").replace(/\.\d+Z?$/, "");
}

export function renderBuildJobStatus(status?: string | null) {
  if (status === "completed") return <Tag color="green">已完成</Tag>;
  if (status === "failed") return <Tag color="red">失败</Tag>;
  if (status === "running") return <Tag color="processing">分析中</Tag>;
  return <Tag color="gold">排队中</Tag>;
}

export function normalizeCategoryOptions(record: LabIndustryIncubationRecord | null) {
  const researchCatalog =
    record?.standardAssets && typeof record.standardAssets === "object"
      ? (record.standardAssets as { researchCatalog?: { categoryTree?: Array<Record<string, unknown>> } }).researchCatalog
      : undefined;
  const categoryTree = Array.isArray(researchCatalog?.categoryTree) ? researchCatalog.categoryTree : [];
  return categoryTree
    .map((item) => ({
      label: String(item?.categoryName || item?.categoryCode || ""),
      value: String(item?.categoryCode || ""),
    }))
    .filter((item) => item.value);
}
