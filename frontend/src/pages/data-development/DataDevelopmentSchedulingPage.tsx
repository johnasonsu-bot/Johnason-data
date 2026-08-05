import { Card, Empty, Space, Tabs, message } from "antd";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchDevWorkflows } from "../../services/dataDevelopment";
import type { DevWorkflowRecord } from "../../types/api";
import { InstanceMonitor } from "./components/InstanceMonitor";
import { WorkflowList } from "./components/WorkflowList";

export function DataDevelopmentSchedulingPage() {
  const { token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get("tab") === "instances" ? "instances" : "workflows";
  const workflowIdFromQuery = Number(searchParams.get("workflowId") || "") || undefined;
  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState<DevWorkflowRecord[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | undefined>(workflowIdFromQuery);

  async function loadWorkflows() {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetchDevWorkflows(token);
      setWorkflows(response.data);
      setSelectedWorkflowId((current) => current || workflowIdFromQuery || response.data[0]?.id);
    } catch (error: any) {
      message.error(error.message || "加载调度管理失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkflows();
  }, [token]);

  useEffect(() => {
    if (workflowIdFromQuery) setSelectedWorkflowId(workflowIdFromQuery);
  }, [workflowIdFromQuery]);

  if (!token) {
    return <Empty description="未登录" />;
  }

  return (
    <Space direction="vertical" size={20} style={{ display: "flex" }}>
      <Card variant="borderless">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => navigate(key === "instances"
            ? `/dashboard/data-development/scheduling?tab=instances${selectedWorkflowId ? `&workflowId=${selectedWorkflowId}` : ""}`
            : "/dashboard/data-development/scheduling")}
          items={[
            {
              key: "workflows",
              label: "工作流管理",
              children: (
                <WorkflowList
                  token={token}
                  workflows={workflows}
                  loading={loading}
                  onRefresh={loadWorkflows}
                  onEditWorkflow={(workflowId) => navigate(`/dashboard/data-development/scheduling/${workflowId}/edit`)}
                  onOpenInstances={(workflowId) => navigate(`/dashboard/data-development/scheduling?tab=instances&workflowId=${workflowId}`)}
                />
              ),
            },
            {
              key: "instances",
              label: "运行监控",
              children: (
                <InstanceMonitor
                  token={token}
                  workflows={workflows}
                  selectedWorkflowId={selectedWorkflowId}
                  onSelectWorkflow={(workflowId) => {
                    setSelectedWorkflowId(workflowId);
                    navigate(`/dashboard/data-development/scheduling?tab=instances${workflowId ? `&workflowId=${workflowId}` : ""}`);
                  }}
                />
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
