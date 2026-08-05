import { Card, Empty, Space, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchDevDatasources, fetchDevOrchestration } from "../../services/dataDevelopment";
import type { DevDatasourceRecord, DevOrchestrationTaskRecord } from "../../types/api";
import { OrchestrationDesigner } from "./components/OrchestrationDesigner";

export function DataDevelopmentOrchestrationEditorPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const taskId = Number(id || 0) || undefined;
  const [loading, setLoading] = useState(false);
  const [datasources, setDatasources] = useState<DevDatasourceRecord[]>([]);
  const [task, setTask] = useState<DevOrchestrationTaskRecord | null>(null);

  async function loadPage() {
    if (!token || !taskId) return;
    setLoading(true);
    try {
      const [datasourceRes, taskRes] = await Promise.all([
        fetchDevDatasources(token),
        fetchDevOrchestration(token, taskId),
      ]);
      setDatasources(datasourceRes.data);
      setTask(taskRes.data);
    } catch (error: any) {
      message.error(error.message || "加载算子任务编辑页失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
  }, [taskId, token]);

  if (!taskId) {
    return (
      <Card variant="borderless">
        <Empty description="算子任务不存在" />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={20} style={{ display: "flex" }}>
      <Card variant="borderless" loading={loading}>
        {task ? (
          <OrchestrationDesigner
            token={token!}
            datasources={datasources}
            task={task}
            onRefresh={loadPage}
            onBackToList={() => navigate("/dashboard/data-development/operator-platform")}
          />
        ) : (
          <Empty description="未找到算子任务" />
        )}
      </Card>
    </Space>
  );
}
