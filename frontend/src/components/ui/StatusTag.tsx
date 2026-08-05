import { Badge, Tag } from "antd";

type StatusTagTone = "default" | "success" | "processing" | "warning" | "error";

type StatusTagProps = {
  status?: string | null;
  label?: string;
  tone?: StatusTagTone;
  showDot?: boolean;
};

const STATUS_MAP: Record<string, { label: string; tone: StatusTagTone }> = {
  active: { label: "启用", tone: "success" },
  inactive: { label: "停用", tone: "default" },
  online: { label: "在线", tone: "success" },
  offline: { label: "离线", tone: "error" },
  disabled: { label: "禁用", tone: "default" },
  unknown: { label: "未知", tone: "warning" },
  running: { label: "运行中", tone: "processing" },
  processing: { label: "处理中", tone: "processing" },
  success: { label: "成功", tone: "success" },
  completed: { label: "已完成", tone: "success" },
  paused: { label: "已暂停", tone: "warning" },
  stopped: { label: "已停止", tone: "default" },
  cancelled: { label: "已取消", tone: "default" },
  degraded: { label: "异常", tone: "warning" },
  failed: { label: "失败", tone: "error" },
  draft: { label: "草稿", tone: "default" },
  pending: { label: "待配置", tone: "warning" },
  recommended: { label: "推荐中", tone: "processing" },
  submitted: { label: "已提交", tone: "success" },
  expired: { label: "已过期", tone: "warning" },
  tampered: { label: "已锁定", tone: "error" },
};

const BADGE_STATUS_MAP: Record<StatusTagTone, "default" | "success" | "processing" | "warning" | "error"> = {
  default: "default",
  success: "success",
  processing: "processing",
  warning: "warning",
  error: "error",
};

const TAG_COLOR_MAP: Record<StatusTagTone, string> = {
  default: "default",
  success: "success",
  processing: "processing",
  warning: "warning",
  error: "error",
};

export function StatusTag(props: StatusTagProps) {
  const { status, label, tone, showDot } = props;
  const normalizedStatus = String(status || "").toLowerCase();
  const meta = STATUS_MAP[normalizedStatus] || { label: label || normalizedStatus || "未设置", tone: tone || "default" };
  const finalLabel = label || meta.label;
  const finalTone = tone || meta.tone;

  if (showDot) {
    return <Badge status={BADGE_STATUS_MAP[finalTone]} text={finalLabel} />;
  }

  return (
    <Tag bordered={false} color={TAG_COLOR_MAP[finalTone]} className="status-tag">
      {finalLabel}
    </Tag>
  );
}
