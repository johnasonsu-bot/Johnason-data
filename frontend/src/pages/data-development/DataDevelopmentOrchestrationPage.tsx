import { Card, Empty, Space, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchDevDatasources, fetchDevOrchestrations } from "../../services/dataDevelopment";
import type { DevDatasourceRecord, DevOrchestrationTaskRecord } from "../../types/api";
import { OrchestrationTaskList } from "./components/OrchestrationTaskList";

export function DataDevelopmentOrchestrationPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [datasources, setDatasources] = useState<DevDatasourceRecord[]>([]);
  const [tasks, setTasks] = useState<DevOrchestrationTaskRecord[]>([]);

  async function loadPage() {
    if (!token) return;
    setLoading(true);
    try {
      const [datasourceRes, taskRes] = await Promise.all([
        fetchDevDatasources(token),
        fetchDevOrchestrations(token),
      ]);
      setDatasources(datasourceRes.data);
      setTasks(taskRes.data);
    } catch (error: any) {
      message.error(error.message || "加载算子平台失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
  }, [token]);

  if (!token) {
    return (
      <Card variant="borderless">
        <Empty description="未登录" />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={20} style={{ display: "flex" }}>
      <Card variant="borderless">
        <OrchestrationTaskList
          token={token}
          datasources={datasources}
          tasks={tasks}
          loading={loading}
          onRefresh={loadPage}
          onEditTask={(taskId) => navigate(`/dashboard/data-development/operator-platform/${taskId}/edit`)}
        />
      </Card>
    </Space>
  );
}
