import { Card, Empty, Space, message } from "antd";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  fetchDevDatasources,
  fetchDevQueryHistory,
  fetchDevScriptFolders,
  fetchDevWorkflows,
} from "../../services/dataDevelopment";
import type {
  DevDatasourceRecord,
  DevQueryHistoryRecord,
  DevScriptFolderRecord,
  DevScriptRecord,
  DevWorkflowRecord,
} from "../../types/api";
import { DatasourceManager } from "./components/DatasourceManager";
import { InstanceMonitor } from "./components/InstanceMonitor";
import { SqlWorkbench } from "./components/SqlWorkbench";

function resolveSection(pathname: string) {
  if (pathname.startsWith("/dashboard/data-development/datasources")) return "datasource";
  if (pathname.startsWith("/dashboard/data-development/instances")) return "instances";
  return "workbench";
}

export function DataDevelopmentPage() {
  const { token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const section = resolveSection(location.pathname);
  const datasourceIdFromQuery = Number(searchParams.get("datasourceId") || "") || undefined;
  const workflowIdFromQuery = Number(searchParams.get("workflowId") || "") || undefined;

  const [loading, setLoading] = useState(false);
  const [datasources, setDatasources] = useState<DevDatasourceRecord[]>([]);
  const [folders, setFolders] = useState<DevScriptFolderRecord[]>([]);
  const [queryHistory, setQueryHistory] = useState<DevQueryHistoryRecord[]>([]);
  const [workflows, setWorkflows] = useState<DevWorkflowRecord[]>([]);
  const [selectedDatasourceId, setSelectedDatasourceId] = useState<number | undefined>(undefined);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | undefined>(undefined);
  const [workbenchScript, setWorkbenchScript] = useState<DevScriptRecord | null>(null);
  const [workbenchSqlSeed, setWorkbenchSqlSeed] = useState<string>("SELECT 1 AS demo;");

  async function loadBootstrap(options?: { quiet?: boolean }) {
    if (!token) return;
    if (!options?.quiet) setLoading(true);
    try {
      const [datasourceRes, folderRes, historyRes, workflowRes] = await Promise.all([
        fetchDevDatasources(token),
        fetchDevScriptFolders(token),
        fetchDevQueryHistory(token, { limit: 30 }),
        fetchDevWorkflows(token),
      ]);
      setDatasources(datasourceRes.data);
      setFolders(folderRes.data);
      setQueryHistory(historyRes.data);
      setWorkflows(workflowRes.data);
      if (!selectedDatasourceId && datasourceIdFromQuery) setSelectedDatasourceId(datasourceIdFromQuery);
      if (!selectedWorkflowId && workflowRes.data[0]) setSelectedWorkflowId(workflowRes.data[0].id);
    } catch (error: any) {
      message.error(error.message || "加载数据开发页面失败");
    } finally {
      if (!options?.quiet) setLoading(false);
    }
  }

  async function refreshHistory() {
    if (!token) return;
    const res = await fetchDevQueryHistory(token, { limit: 30 });
    setQueryHistory(res.data);
  }

  useEffect(() => {
    void loadBootstrap();
  }, [token]);

  useEffect(() => {
    if (datasourceIdFromQuery) {
      setSelectedDatasourceId(datasourceIdFromQuery);
    }
  }, [datasourceIdFromQuery]);

  useEffect(() => {
    if (workflowIdFromQuery) {
      setSelectedWorkflowId(workflowIdFromQuery);
    }
  }, [workflowIdFromQuery]);

  const content = (() => {
    if (!token) {
      return <Empty description="未登录" />;
    }

    if (section === "datasource") {
      return (
        <DatasourceManager
          token={token}
          datasources={datasources}
          loading={loading}
          onRefresh={() => loadBootstrap({ quiet: true })}
          onOpenWorkbench={(datasourceId, databaseName) => {
            setSelectedDatasourceId(datasourceId);
            navigate(`/dashboard/data-development/workbench2?datasourceId=${datasourceId}${databaseName ? `&databaseName=${encodeURIComponent(databaseName)}` : ""}`);
          }}
        />
      );
    }

    if (section === "instances") {
      return (
        <InstanceMonitor
          token={token}
          workflows={workflows}
          selectedWorkflowId={selectedWorkflowId}
          onSelectWorkflow={(value) => {
            setSelectedWorkflowId(value);
            navigate(value ? `/dashboard/data-development/instances?workflowId=${value}` : "/dashboard/data-development/instances");
          }}
        />
      );
    }

    return (
      <SqlWorkbench
        token={token}
        datasources={datasources}
        folders={folders}
        queryHistory={queryHistory}
        onHistoryRefresh={refreshHistory}
        onScriptsRefresh={() => loadBootstrap({ quiet: true })}
        selectedDatasourceId={selectedDatasourceId}
        onSelectDatasource={(value) => {
          setSelectedDatasourceId(value);
          navigate(`/dashboard/data-development/workbench2?datasourceId=${value}`);
        }}
        initialSql={workbenchSqlSeed}
        script={workbenchScript}
        onScriptChange={setWorkbenchScript}
      />
    );
  })();

  return (
    <Space direction="vertical" size={20} style={{ display: "flex" }}>
      <Card bordered={false}>{content}</Card>
    </Space>
  );
}
