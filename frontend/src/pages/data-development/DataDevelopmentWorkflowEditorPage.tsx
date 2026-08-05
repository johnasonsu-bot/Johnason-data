import { Card, Empty, Space, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { fetchDevDatasources, fetchDevOrchestrations, fetchDevProcessingJobs, fetchDevScripts, fetchDevWorkflow } from "../../services/dataDevelopment";
import type { DevDatasourceRecord, DevOrchestrationTaskRecord, DevProcessingJobRecord, DevScriptRecord, DevWorkflowRecord } from "../../types/api";
import { WorkflowDesigner } from "./components/WorkflowDesigner";

export function DataDevelopmentWorkflowEditorPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const workflowId = Number(id || 0) || undefined;

  const [loading, setLoading] = useState(false);
  const [datasources, setDatasources] = useState<DevDatasourceRecord[]>([]);
  const [scripts, setScripts] = useState<DevScriptRecord[]>([]);
  const [processingJobs, setProcessingJobs] = useState<DevProcessingJobRecord[]>([]);
  const [orchestrationTasks, setOrchestrationTasks] = useState<DevOrchestrationTaskRecord[]>([]);
  const [workflow, setWorkflow] = useState<DevWorkflowRecord | null>(null);

  async function loadPage() {
    if (!token || !workflowId) return;
    setLoading(true);
    try {
      const [datasourceRes, scriptRes, processingRes, orchestrationRes, workflowRes] = await Promise.all([
        fetchDevDatasources(token),
        fetchDevScripts(token),
        fetchDevProcessingJobs(token),
        fetchDevOrchestrations(token),
        fetchDevWorkflow(token, workflowId),
      ]);
      setDatasources(datasourceRes.data);
      setScripts(scriptRes.data);
      setProcessingJobs(processingRes.data);
      setOrchestrationTasks(orchestrationRes.data);
      setWorkflow(workflowRes.data);
    } catch (error: any) {
      message.error(error.message || "加载工作流编辑页失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
  }, [token, workflowId]);

  if (!workflowId) {
    return (
      <Card variant="borderless">
        <Empty description="工作流不存在" />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={20} style={{ display: "flex" }}>
      <Card variant="borderless" loading={loading}>
        {workflow ? (
          <WorkflowDesigner
            token={token!}
            datasources={datasources}
            scripts={scripts}
            processingJobs={processingJobs}
            orchestrationTasks={orchestrationTasks}
            selectedWorkflowId={workflowId}
            selectedWorkflow={workflow}
            onRefresh={loadPage}
            onReloadDetail={async () => {
              await loadPage();
            }}
            onOpenInstances={(nextWorkflowId) => navigate(`/dashboard/data-development/scheduling?tab=instances&workflowId=${nextWorkflowId}`)}
            onBackToList={() => navigate("/dashboard/data-development/scheduling")}
          />
        ) : (
          <Empty description="未找到工作流" />
        )}
      </Card>
    </Space>
  );
}
