import MonacoEditor from "@monaco-editor/react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tree,
  Typography,
  message,
} from "antd";
import type { DataNode } from "antd/es/tree";
import { useEffect, useMemo, useRef, useState } from "react";
import { format as formatSql } from "sql-formatter";
import {
  createDevScript,
  executeDevQuery,
  fetchDevColumns,
  fetchDevDatabases,
  fetchDevFunctions,
  fetchDevTables,
  updateDevScript,
} from "../../../services/dataDevelopment";
import type {
  DevDatasourceRecord,
  DevQueryExecutionResult,
  DevQueryHistoryRecord,
  DevRoutineEntry,
  DevScriptFolderRecord,
  DevScriptRecord,
  DevTableEntry,
} from "../../../types/api";
import { detectSqlLanguage, formatDateTime } from "../helpers";

interface SqlWorkbenchProps {
  token: string;
  datasources: DevDatasourceRecord[];
  folders: DevScriptFolderRecord[];
  queryHistory: DevQueryHistoryRecord[];
  onHistoryRefresh: () => Promise<void>;
  onScriptsRefresh: () => Promise<void>;
  selectedDatasourceId?: number;
  onSelectDatasource: (value: number) => void;
  initialSql?: string;
  script?: DevScriptRecord | null;
  onScriptChange: (script: DevScriptRecord | null) => void;
}

function classifyTables(tables: DevTableEntry[]) {
  const views: DevTableEntry[] = [];
  const baseTables: DevTableEntry[] = [];

  for (const table of tables) {
    if (String(table.type || "").toUpperCase().includes("VIEW")) {
      views.push(table);
    } else {
      baseTables.push(table);
    }
  }

  return { baseTables, views };
}

function buildDbNode(databaseName: string, tables: DevTableEntry[], routines: DevRoutineEntry[]): DataNode {
  const { baseTables, views } = classifyTables(tables);
  const tableChildren: DataNode[] = baseTables.map((table) => ({
    key: `table:${databaseName}:${table.name}`,
    title: table.name,
    isLeaf: false,
  }));
  const viewChildren: DataNode[] = views.map((table) => ({
    key: `view:${databaseName}:${table.name}`,
    title: table.name,
    isLeaf: false,
  }));
  const functionChildren: DataNode[] = routines.map((routine) => ({
    key: `function:${databaseName}:${routine.name}`,
    title: routine.schema ? `${routine.name} (${routine.schema})` : routine.name,
    isLeaf: true,
  }));

  return {
    key: `db:${databaseName}`,
    title: databaseName,
    children: [
      { key: `group:${databaseName}:tables`, title: `表 (${tableChildren.length})`, children: tableChildren, selectable: false },
      { key: `group:${databaseName}:views`, title: `视图 (${viewChildren.length})`, children: viewChildren, selectable: false },
      { key: `group:${databaseName}:functions`, title: `函数 (${functionChildren.length})`, children: functionChildren, selectable: false },
    ],
  };
}

export function SqlWorkbench({
  token,
  datasources,
  folders,
  queryHistory,
  onHistoryRefresh,
  onScriptsRefresh,
  selectedDatasourceId,
  onSelectDatasource,
  initialSql,
  script,
  onScriptChange,
}: SqlWorkbenchProps) {
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Array<string | number>>([]);
  const [sqlText, setSqlText] = useState(initialSql || "SELECT 1 AS demo;");
  const [resultLimit, setResultLimit] = useState(200);
  const [result, setResult] = useState<DevQueryExecutionResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState("result");
  const [saveForm] = Form.useForm();
  const editorRef = useRef<any>(null);
  const editorLayoutFrameRef = useRef<number | null>(null);

  const datasource = useMemo(
    () => datasources.find((item) => item.id === selectedDatasourceId),
    [datasources, selectedDatasourceId]
  );
  const hasSelectedDatasource = Boolean(selectedDatasourceId);
  const editorOptions = useMemo(
    () => ({
      minimap: { enabled: false },
      fontSize: 14,
      wordWrap: "on" as const,
      automaticLayout: false,
      scrollBeyondLastLine: false,
    }),
    []
  );

  useEffect(() => {
    if (initialSql) {
      setSqlText(initialSql);
    }
  }, [initialSql]);

  function scheduleEditorLayout() {
    if (!editorRef.current) return;
    if (editorLayoutFrameRef.current) {
      window.cancelAnimationFrame(editorLayoutFrameRef.current);
    }
    editorLayoutFrameRef.current = window.requestAnimationFrame(() => {
      editorRef.current?.layout?.();
      editorLayoutFrameRef.current = null;
    });
  }

  useEffect(() => {
    return () => {
      if (editorLayoutFrameRef.current) {
        window.cancelAnimationFrame(editorLayoutFrameRef.current);
      }
    };
  }, []);

  async function attachColumns(nodeKey: string, databaseName: string, objectName: string) {
    if (!selectedDatasourceId) return;
    const res = await fetchDevColumns(token, selectedDatasourceId, databaseName, objectName);
    const attach = (nodes: DataNode[]): DataNode[] =>
      nodes.map((item) => {
        if (item.key === nodeKey) {
          return {
            ...item,
            children: res.data.map((column) => ({
              key: `column:${objectName}:${column.name}`,
              title: `${column.name} (${column.dataType})`,
              isLeaf: true,
            })),
          };
        }
        return { ...item, children: item.children ? attach(item.children) : item.children };
      });
    setTreeData((prev) => attach(prev));
  }

  async function loadDatabaseObjects(datasourceId: number, databaseName: string) {
    const [tableRes, functionRes] = await Promise.all([
      fetchDevTables(token, datasourceId, databaseName),
      fetchDevFunctions(token, datasourceId, databaseName),
    ]);

    return buildDbNode(databaseName, tableRes.data, functionRes.data);
  }

  async function loadRoot(datasourceId: number, preferredDatabaseName?: string | null) {
    const dbRes = await fetchDevDatabases(token, datasourceId);
    const databases = dbRes.data.map((db) => db.name);
    if (!databases.length) {
      setTreeData([]);
      setExpandedKeys([]);
      return;
    }

    const preferred = preferredDatabaseName && databases.includes(preferredDatabaseName)
      ? preferredDatabaseName
      : preferredDatabaseName || databases[0];

    const nodes = await Promise.all(
      databases.map(async (databaseName) => {
        if (databaseName === preferred) {
          return loadDatabaseObjects(datasourceId, databaseName);
        }
        return {
          key: `db:${databaseName}`,
          title: databaseName,
          children: [],
        };
      })
    );

    setTreeData(nodes);
    if (preferred) {
      setExpandedKeys([
        `db:${preferred}`,
        `group:${preferred}:tables`,
        `group:${preferred}:views`,
        `group:${preferred}:functions`,
      ]);
    } else {
      setExpandedKeys([]);
    }
  }

  async function handleDatasourceChange(value: number) {
    onSelectDatasource(value);
    const target = datasources.find((item) => item.id === value);
    await loadRoot(value, target?.databaseName);
    scheduleEditorLayout();
  }

  async function handleLoadData(node: any) {
    if (!selectedDatasourceId) return;
    const key = String(node.key);

    if (key.startsWith("db:") && (!node.children || node.children.length === 0)) {
      const databaseName = key.slice(3);
      const dbNode = await loadDatabaseObjects(selectedDatasourceId, databaseName);
      setTreeData((prev) => prev.map((item) => (item.key === key ? dbNode : item)));
      setExpandedKeys((prev) => Array.from(new Set([
        ...prev,
        key,
        `group:${databaseName}:tables`,
        `group:${databaseName}:views`,
        `group:${databaseName}:functions`,
      ])));
      return;
    }

    if (key.startsWith("table:") || key.startsWith("view:")) {
      const [, databaseName, objectName] = key.split(":");
      await attachColumns(key, databaseName, objectName);
    }
  }

  useEffect(() => {
    if (!selectedDatasourceId || !token) return;
    void loadRoot(selectedDatasourceId, datasource?.databaseName);
  }, [selectedDatasourceId, token, datasource?.databaseName]);

  useEffect(() => {
    if (!hasSelectedDatasource) return;
    scheduleEditorLayout();
  }, [hasSelectedDatasource, activeTabKey, result?.status]);

  async function handleExecute() {
    if (!selectedDatasourceId) {
      message.warning("请先选择数据源");
      return;
    }
    setRunning(true);
    setLogs((prev) => [`开始执行 ${formatDateTime(new Date().toISOString())}`, ...prev].slice(0, 20));
    try {
      const res = await executeDevQuery(token, {
        datasourceId: selectedDatasourceId,
        scriptId: script?.id,
        sqlText,
        databaseName: datasource?.databaseName,
        resultLimit,
      });
      setResult(res.data);
      setLogs((prev) => [`执行${res.data.status === "success" ? "成功" : "失败"}，耗时 ${res.data.durationMs}ms`, ...prev].slice(0, 20));
      await onHistoryRefresh();
    } catch (error: any) {
      message.error(error.message || "执行 SQL 失败");
    } finally {
      setRunning(false);
    }
  }

  async function handleSaveScript() {
    const values = await saveForm.validateFields();
    const payload = {
      ...values,
      tags: String(values.tags || "")
        .split(",")
        .map((item: string) => item.trim())
        .filter(Boolean),
      content: values.content || sqlText,
    };
    try {
      if (script?.id) {
        await updateDevScript(token, script.id, payload);
        message.success("脚本已更新");
      } else {
        const res = await createDevScript(token, payload);
        onScriptChange(res.data);
        message.success("脚本已保存");
      }
      setSaveModalOpen(false);
      await onScriptsRefresh();
    } catch (error: any) {
      message.error(error.message || "保存脚本失败");
    }
  }

  function openSaveModal() {
    saveForm.setFieldsValue({
      name: script?.name || "",
      folderId: script?.folderId ?? null,
      datasourceId: script?.datasourceId || selectedDatasourceId,
      defaultDatabase: script?.defaultDatabase || datasource?.databaseName,
      description: script?.description || "",
      tags: script?.tags?.join(",") || "",
      content: sqlText,
    });
    setSaveModalOpen(true);
  }

  return (
    <Row gutter={16} className="sql-workbench-root">
      <Col span={6}>
        <Card title="库表浏览" size="small">
          <Space direction="vertical" size={12} style={{ display: "flex" }}>
            <Select
              placeholder="选择数据源"
              value={selectedDatasourceId}
              onChange={(value) => void handleDatasourceChange(value)}
              options={datasources.map((item) => ({ value: item.id, label: `${item.name} (${item.type})` }))}
            />
            <Tree
              loadData={handleLoadData as any}
              treeData={treeData}
              expandedKeys={expandedKeys}
              onExpand={(keys) => setExpandedKeys(keys.map((key) => (typeof key === "bigint" ? Number(key) : key as string | number)))}
              onSelect={(keys) => {
                const key = String(keys[0] || "");
                if (key.startsWith("table:") || key.startsWith("view:")) {
                  const [kind, , objectName] = key.split(":");
                  const statement = kind === "view"
                    ? `SELECT *\nFROM ${objectName}\nLIMIT 100;`
                    : `SELECT *\nFROM ${objectName}\nLIMIT 100;`;
                  setSqlText(statement);
                }
                if (key.startsWith("function:")) {
                  const [, , functionName] = key.split(":");
                  setSqlText(`SELECT ${functionName}();`);
                }
              }}
            />
          </Space>
        </Card>
      </Col>
      <Col span={18}>
        <Space direction="vertical" size={16} style={{ display: "flex" }}>
          <Card
            title="SQL 编辑器"
            extra={(
              <Space>
                <InputNumber min={1} max={1000} value={resultLimit} onChange={(value) => setResultLimit(Number(value || 200))} />
                <Button onClick={() => setSqlText(formatSql(sqlText, { language: detectSqlLanguage(datasource?.type) as any }))}>格式化</Button>
                <Button onClick={openSaveModal}>保存脚本</Button>
                <Button type="primary" loading={running} onClick={() => void handleExecute()}>执行</Button>
              </Space>
            )}
          >
            {hasSelectedDatasource ? (
              <div style={{ display: "flex", flex: 1, minWidth: 0, minHeight: 0, height: 360, overflow: "hidden" }}>
                <MonacoEditor
                  height="360px"
                  language="sql"
                  value={sqlText}
                  onChange={(value) => setSqlText(value || "")}
                  options={editorOptions}
                  onMount={(editor) => {
                    editorRef.current = editor;
                    scheduleEditorLayout();
                  }}
                />
              </div>
            ) : (
              <div style={{ height: 360, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Empty description="请先在左侧选择一个开发数据源，再打开 SQL 编辑器" />
              </div>
            )}
          </Card>

          <Tabs
            activeKey={activeTabKey}
            onChange={(key) => {
              setActiveTabKey(key);
              scheduleEditorLayout();
            }}
            items={[
              {
                key: "result",
                label: "执行结果",
                children: result?.status === "failed" ? (
                  <Alert type="error" message={result.errorMessage || "执行失败"} />
                ) : (
                  <Table
                    rowKey={(_, index) => String(index)}
                    dataSource={result?.rows || []}
                    pagination={{ pageSize: 6 }}
                    scroll={{ x: "max-content" }}
                    columns={(result?.fields || []).map((field) => ({
                      title: field,
                      dataIndex: field,
                      key: field,
                      render: (value: unknown) => (value === null || value === undefined ? "-" : String(value)),
                    }))}
                  />
                ),
              },
              {
                key: "history",
                label: "查询历史",
                children: (
                  <Table
                    rowKey="id"
                    dataSource={queryHistory}
                    pagination={{ pageSize: 6 }}
                    columns={[
                      { title: "数据源", dataIndex: "datasourceName" },
                      { title: "状态", dataIndex: "status" },
                      { title: "耗时", dataIndex: "durationMs", render: (value: number) => `${value}ms` },
                      { title: "时间", dataIndex: "executedAt", render: formatDateTime },
                      { title: "操作", render: (_, record) => <Button type="link" onClick={() => setSqlText(record.sqlText)}>载入</Button> },
                    ]}
                  />
                ),
              },
              {
                key: "logs",
                label: "执行日志",
                children: <Input.TextArea value={logs.join("\n")} rows={8} readOnly />,
              },
            ]}
          />
        </Space>
      </Col>

      <Modal open={saveModalOpen} title="保存脚本" onOk={() => void handleSaveScript()} onCancel={() => setSaveModalOpen(false)} width={760}>
        <Form layout="vertical" form={saveForm}>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="folderId" label="文件夹"><Select allowClear options={folders.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="datasourceId" label="数据源" rules={[{ required: true }]}><Select options={datasources.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="defaultDatabase" label="默认库"><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="description" label="描述"><Input /></Form.Item>
          <Form.Item name="tags" label="标签"><Input placeholder="逗号分隔" /></Form.Item>
          <Form.Item name="content" label="SQL 内容" rules={[{ required: true }]}><Input.TextArea rows={8} /></Form.Item>
        </Form>
      </Modal>
    </Row>
  );
}
