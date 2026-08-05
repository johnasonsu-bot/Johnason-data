import MonacoEditor from "@monaco-editor/react";
import {
  CalendarOutlined,
  CloseOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Select,
  Space,
  Tabs,
  Tree,
  Typography,
  message,
} from "antd";
import type { DataNode } from "antd/es/tree";
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { format as formatSql } from "sql-formatter";
import { PageToolbar } from "../../components/ui/PageToolbar";
import { StatusTag } from "../../components/ui/StatusTag";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  createDevScript,
  createDevWorkflowFromTask,
  executeDevQuery,
  fetchDevColumns,
  fetchDevDatabases,
  fetchDevDatasources,
  fetchDevFunctions,
  fetchDevQueryHistory,
  fetchDevScripts,
  fetchDevTables,
  updateDevScript,
} from "../../services/dataDevelopment";
import type {
  DevColumnEntry,
  DevDatabaseEntry,
  DevDatasourceRecord,
  DevQueryExecutionResult,
  DevQueryHistoryRecord,
  DevRoutineEntry,
  DevScriptRecord,
  DevTableEntry,
} from "../../types/api";
import { SqlCopilotPanel } from "./components/SqlCopilotPanel";
import { detectSqlLanguage, formatDateTime } from "./helpers";
import { splitSqlStatements } from "./sqlTaskUtils";

type SaveScriptFormValues = {
  name: string;
  description?: string;
  tags?: string;
};

type ExecutionItem = {
  key: string;
  title: string;
  sqlText: string;
  result: DevQueryExecutionResult;
  resultColumns: DevColumnEntry[];
};

function buildObjectTree(selectedDatabase: string, tables: DevTableEntry[], functions: DevRoutineEntry[]): DataNode[] {
  if (!selectedDatabase) return [];

  const tableItems = tables.filter((item) => !/view/i.test(String(item.type || "")));
  const viewItems = tables.filter((item) => /view/i.test(String(item.type || "")));

  return [
    {
      key: `group:${selectedDatabase}:tables`,
      title: `表 (${tableItems.length})`,
      selectable: false,
      children: tableItems.map((table) => ({
        key: `table:${selectedDatabase}:${table.name}`,
        title: table.name,
        isLeaf: true,
      })),
    },
    {
      key: `group:${selectedDatabase}:views`,
      title: `视图 (${viewItems.length})`,
      selectable: false,
      children: viewItems.map((table) => ({
        key: `table:${selectedDatabase}:${table.name}`,
        title: table.name,
        isLeaf: true,
      })),
    },
    {
      key: `group:${selectedDatabase}:functions`,
      title: `函数 (${functions.length})`,
      selectable: false,
      children: functions.map((item) => ({
        key: `function:${selectedDatabase}:${item.name}`,
        title: item.schema ? `${item.name} (${item.schema})` : item.name,
        isLeaf: true,
      })),
    },
  ];
}

export function DataDevelopmentWorkbench2Page() {
  const { token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [saveForm] = Form.useForm<SaveScriptFormValues>();
  const searchParams = new URLSearchParams(location.search);
  const datasourceIdFromQuery = Number(searchParams.get("datasourceId") || "") || undefined;
  const databaseNameFromQuery = searchParams.get("databaseName") || "";
  const scriptIdFromQuery = Number(searchParams.get("scriptId") || "") || undefined;

  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  const [datasources, setDatasources] = useState<DevDatasourceRecord[]>([]);
  const [scripts, setScripts] = useState<DevScriptRecord[]>([]);
  const [queryHistory, setQueryHistory] = useState<DevQueryHistoryRecord[]>([]);
  const [databases, setDatabases] = useState<DevDatabaseEntry[]>([]);
  const [tables, setTables] = useState<DevTableEntry[]>([]);
  const [functions, setFunctions] = useState<DevRoutineEntry[]>([]);

  const [selectedDatasourceId, setSelectedDatasourceId] = useState<number | undefined>(undefined);
  const [selectedDatabase, setSelectedDatabase] = useState("");
  const [selectedScriptId, setSelectedScriptId] = useState<number | undefined>(undefined);
  const [creatingSchedule, setCreatingSchedule] = useState(false);

  const [sqlText, setSqlText] = useState("SELECT 1 AS demo;");
  const [selectedSql, setSelectedSql] = useState("");
  const [resultLimit, setResultLimit] = useState(200);
  const [executionResults, setExecutionResults] = useState<ExecutionItem[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotExpanded, setCopilotExpanded] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [editorHeight, setEditorHeight] = useState(420);
  const [activeResultKey, setActiveResultKey] = useState("history");
  const [copilotPosition, setCopilotPosition] = useState(() => ({
    x: typeof window !== "undefined" ? Math.max(window.innerWidth - 520, 320) : 320,
    y: 120,
  }));

  const editorRef = useRef<any>(null);
  const copilotDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const resizeDragRef = useRef<{ startY: number; originHeight: number } | null>(null);

  const selectedDatasource = useMemo(
    () => datasources.find((item) => item.id === selectedDatasourceId) || null,
    [datasources, selectedDatasourceId]
  );

  const selectedScript = useMemo(
    () => scripts.find((item) => item.id === selectedScriptId) || null,
    [scripts, selectedScriptId]
  );

  async function handleCreateSchedule() {
    if (!token || !selectedScript) return;
    setCreatingSchedule(true);
    try {
      const response = await createDevWorkflowFromTask(token, { taskType: "script", taskId: selectedScript.id });
      message.success("调度工作流已创建");
      navigate(`/dashboard/data-development/scheduling/${response.data.id}/edit`);
    } catch (error: any) {
      message.error(error.message || "创建调度工作流失败");
    } finally {
      setCreatingSchedule(false);
    }
  }

  const activeExecution = useMemo(
    () => executionResults.find((item) => item.key === activeResultKey) || null,
    [activeResultKey, executionResults]
  );

  const objectTreeData = useMemo(
    () => buildObjectTree(selectedDatabase, tables, functions),
    [functions, selectedDatabase, tables]
  );

  const resultTabItems = useMemo(() => {
    const executionTabs = executionResults.map((item, index) => {
      const commentMap = new Map(item.resultColumns.map((column) => [column.name, column.comment || ""]));
      return {
        key: item.key,
        label: `执行结果${index + 1}`,
        children: item.result.status === "failed" ? (
          <Space direction="vertical" size={12} style={{ display: "flex" }}>
            <Alert type="error" message={item.result.errorMessage || "执行失败"} />
            <Input.TextArea value={item.sqlText} readOnly rows={8} />
          </Space>
        ) : item.result.rows?.length ? (
          <div className="workspace-result-grid">
            <table className="workspace-result-table">
              <thead>
                <tr>
                  {(item.result.fields || []).map((field) => {
                    const comment = commentMap.get(field) || "";
                    return (
                      <th key={field}>
                        <div className="workspace-result-table__head-main" title={field}>{field}</div>
                        <div className="workspace-result-table__head-comment" title={comment}>
                          {comment ? `(${comment})` : ""}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {item.result.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {(item.result.fields || []).map((field) => {
                      const displayValue = row[field] === null || row[field] === undefined ? "-" : String(row[field]);
                      return (
                        <td key={`${rowIndex}-${field}`}>
                          <input
                            className="workspace-result-table__cell-input"
                            readOnly
                            value={displayValue}
                            onFocus={(event) => event.currentTarget.select()}
                            title={displayValue}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Space direction="vertical" size={12} style={{ display: "flex" }}>
            <Alert type="success" message={`执行成功，影响行数 ${item.result.affectedRows || 0}`} />
            <Input.TextArea value={item.sqlText} readOnly rows={8} />
          </Space>
        ),
      };
    });

    return [
      ...executionTabs,
      {
        key: "history",
        label: "查询历史",
        children: (
          <List
            className="soft-list"
            dataSource={queryHistory}
            locale={{ emptyText: "暂无查询历史" }}
            renderItem={(item) => (
              <List.Item className="soft-list__item">
                <div>
                  <div className="soft-list__title">{item.datasourceName}</div>
                  <div className="soft-list__meta">
                    {formatDateTime(item.executedAt)} / {item.durationMs}ms
                  </div>
                </div>
                <Space>
                  <StatusTag status={item.status} />
                  <Button type="link" onClick={() => setSqlText(item.sqlText)}>
                    载入
                  </Button>
                </Space>
              </List.Item>
            )}
          />
        ),
      },
      {
        key: "logs",
        label: "执行日志",
        children: <Input.TextArea value={logs.join("\n")} rows={10} readOnly />,
      },
    ];
  }, [executionResults, logs, queryHistory]);

  async function loadBootstrap() {
    if (!token) return;
    setLoading(true);
    try {
      const [datasourceRes, scriptRes, historyRes] = await Promise.all([
        fetchDevDatasources(token),
        fetchDevScripts(token),
        fetchDevQueryHistory(token, { limit: 30 }),
      ]);
      setDatasources(datasourceRes.data);
      setScripts(scriptRes.data);
      setQueryHistory(historyRes.data);
      const requestedScript = scriptIdFromQuery
        ? scriptRes.data.find((item) => item.id === scriptIdFromQuery)
        : undefined;
      if (requestedScript) {
        setSelectedScriptId(requestedScript.id);
        setSelectedDatasourceId(requestedScript.datasourceId);
        setSelectedDatabase(requestedScript.defaultDatabase || "");
        setSqlText(requestedScript.content);
      } else if (datasourceIdFromQuery) {
        setSelectedDatasourceId(datasourceIdFromQuery);
      } else if (!selectedDatasourceId && datasourceRes.data[0]?.id) {
        setSelectedDatasourceId(datasourceRes.data[0].id);
      }
    } catch (error: any) {
      message.error(error.message || "加载 SQL分析失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadDatasourceObjects(datasourceId: number, preferredDatabaseName?: string) {
    if (!token) return;
    try {
      const databaseRes = await fetchDevDatabases(token, datasourceId);
      setDatabases(databaseRes.data);
      const nextDatabase = preferredDatabaseName || databaseRes.data[0]?.name || "";
      setSelectedDatabase(nextDatabase);

      if (!nextDatabase) {
        setTables([]);
        setFunctions([]);
        return;
      }

      const [tableRes, functionRes] = await Promise.all([
        fetchDevTables(token, datasourceId, nextDatabase),
        fetchDevFunctions(token, datasourceId, nextDatabase),
      ]);
      setTables(tableRes.data);
      setFunctions(functionRes.data);
    } catch (error: any) {
      message.error(error.message || "加载数据库对象失败");
    }
  }

  useEffect(() => {
    if (!token) return;
    void loadBootstrap();
  }, [token]);

  useEffect(() => {
    if (!selectedDatasourceId) return;
    const preferredDatabase = databaseNameFromQuery
      || selectedScript?.defaultDatabase
      || datasources.find((item) => item.id === selectedDatasourceId)?.databaseName
      || selectedDatabase;
    void loadDatasourceObjects(selectedDatasourceId, preferredDatabase);
  }, [databaseNameFromQuery, datasources, selectedDatasourceId, selectedScript?.defaultDatabase]);

  async function handleDatabaseChange(databaseName: string) {
    if (!token || !selectedDatasourceId) return;
    setSelectedDatabase(databaseName);
    try {
      const [tableRes, functionRes] = await Promise.all([
        fetchDevTables(token, selectedDatasourceId, databaseName),
        fetchDevFunctions(token, selectedDatasourceId, databaseName),
      ]);
      setTables(tableRes.data);
      setFunctions(functionRes.data);
    } catch (error: any) {
      message.error(error.message || "切换数据库失败");
    }
  }

  function syncSelectedSql() {
    const editor = editorRef.current;
    const model = editor?.getModel?.();
    const selection = editor?.getSelection?.();
    if (!model || !selection || selection.isEmpty()) {
      setSelectedSql("");
      return;
    }
    setSelectedSql(model.getValueInRange(selection) || "");
  }

  async function loadColumnsForSql(sqlFragment: string) {
    if (!token || !selectedDatasourceId || !selectedDatabase) return [];
    const tableMatch = String(sqlFragment || "").match(/\bfrom\s+([`"\w.]+)/i);
    if (!tableMatch?.[1]) return [];
    const tableName = tableMatch[1].replace(/[`,"]/g, "");
    try {
      const columnResponse = await fetchDevColumns(token, selectedDatasourceId, selectedDatabase, tableName);
      return columnResponse.data;
    } catch {
      return [];
    }
  }

  async function executeSqlText(executableSql: string) {
    if (!token || !selectedDatasourceId) return false;
    if (!executableSql) {
      message.warning("没有可执行的 SQL");
      return false;
    }

    const sqlStatements = splitSqlStatements(executableSql);
    if (!sqlStatements.length) {
      message.warning("未识别到可执行的 SQL");
      return false;
    }

    const startedAt = new Date().toISOString();
    setExecuting(true);
    setLogs((current) => [`开始执行 ${formatDateTime(startedAt)}，共 ${sqlStatements.length} 段 SQL`, ...current].slice(0, 30));

    try {
      const nextResults: ExecutionItem[] = [];
      for (let index = 0; index < sqlStatements.length; index += 1) {
        const statement = sqlStatements[index];
        const response = await executeDevQuery(token, {
          datasourceId: selectedDatasourceId,
          scriptId: selectedScript?.id,
          sqlText: statement,
          databaseName: selectedDatabase || selectedDatasource?.databaseName,
          resultLimit,
        });
        const resultColumns = response.data.status === "success" ? await loadColumnsForSql(statement) : [];
        nextResults.push({
          key: `result-${index + 1}`,
          title: `执行结果${index + 1}`,
          sqlText: statement,
          result: response.data,
          resultColumns,
        });
        setLogs((current) => [
          `SQL ${index + 1} ${response.data.status === "success" ? "执行成功" : "执行失败"}，耗时 ${response.data.durationMs}ms`,
          ...current,
        ].slice(0, 30));
      }

      setExecutionResults(nextResults);
      setActiveResultKey(nextResults[0]?.key || "history");
      const historyRes = await fetchDevQueryHistory(token, { limit: 30 });
      setQueryHistory(historyRes.data);
      return nextResults.every((item) => item.result.status === "success");
    } catch (error: any) {
      message.error(error.message || "执行 SQL 失败");
      return false;
    } finally {
      setExecuting(false);
    }
  }

  async function handleExecute() {
    if (!token || !selectedDatasourceId) {
      message.warning("请先选择开发数据源");
      return;
    }
    await executeSqlText(selectedSql.trim() || sqlText.trim());
  }

  function openSaveModal() {
    saveForm.setFieldsValue({
      name: selectedScript?.name || "",
      description: selectedScript?.description || "",
      tags: selectedScript?.tags?.join(", ") || "",
    });
    setSaveModalOpen(true);
  }

  async function handleSaveScript() {
    if (!token || !selectedDatasourceId) {
      message.warning("请先选择开发数据源");
      return;
    }
    const values = await saveForm.validateFields();
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        folderId: null,
        datasourceId: selectedDatasourceId,
        defaultDatabase: selectedDatabase || selectedDatasource?.databaseName || null,
        description: values.description || "",
        tags: String(values.tags || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        content: sqlText,
      };

      if (selectedScript) {
        await updateDevScript(token, selectedScript.id, payload);
        message.success("SQL任务已更新");
      } else {
        const response = await createDevScript(token, payload);
        setSelectedScriptId(response.data.id);
        message.success("SQL任务已保存");
      }

      const scriptRes = await fetchDevScripts(token);
      setScripts(scriptRes.data);
      setSaveModalOpen(false);
    } catch (error: any) {
      message.error(error.message || "保存SQL任务失败");
    } finally {
      setSaving(false);
    }
  }

  function handleUseTable(tableName: string) {
    setSqlText(`SELECT *\nFROM ${tableName}\nLIMIT 100;`);
  }

  function handleUseFunction(functionName: string) {
    setSqlText(`SELECT ${functionName}();`);
  }

  function handleApplyCopilotSql(nextSql: string, mode: "replace_all" | "replace_selection" | "append") {
    const editor = editorRef.current;
    const model = editor?.getModel?.();
    if (!editor || !model) {
      setSqlText(nextSql);
      return;
    }

    const selection = editor.getSelection?.();
    const hasSelection = Boolean(selection && !selection.isEmpty());

    if (mode === "replace_selection" && hasSelection) {
      editor.executeEdits("sql-copilot", [{ range: selection, text: nextSql, forceMoveMarkers: true }]);
    } else if (mode === "append") {
      const lastLine = model.getLineCount();
      const lastColumn = model.getLineMaxColumn(lastLine);
      const prefix = model.getValue().trim() ? "\n\n" : "";
      editor.executeEdits("sql-copilot", [{
        range: {
          startLineNumber: lastLine,
          startColumn: lastColumn,
          endLineNumber: lastLine,
          endColumn: lastColumn,
        },
        text: `${prefix}${nextSql}`,
        forceMoveMarkers: true,
      }]);
    } else {
      editor.setValue(nextSql);
    }

    setSqlText(model.getValue());
    syncSelectedSql();
    editor.focus?.();
  }

  function handleSaveCopilotSql(nextSql: string) {
    handleApplyCopilotSql(nextSql, "replace_all");
    setSelectedScriptId(undefined);
    saveForm.setFieldsValue({ name: "", description: "智能辅助生成的 SQL", tags: "AI" });
    setSaveModalOpen(true);
  }

  function handleCopilotDragStart(event: ReactMouseEvent<HTMLDivElement>) {
    copilotDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: copilotPosition.x,
      originY: copilotPosition.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const state = copilotDragRef.current;
      if (!state) return;
      const nextX = state.originX + (moveEvent.clientX - state.startX);
      const nextY = state.originY + (moveEvent.clientY - state.startY);
      const maxX = Math.max(window.innerWidth - (copilotExpanded ? 760 : 520), 24);
      const maxY = Math.max(window.innerHeight - 160, 24);
      setCopilotPosition({
        x: Math.min(Math.max(16, nextX), maxX),
        y: Math.min(Math.max(80, nextY), maxY),
      });
    };

    const handleMouseUp = () => {
      copilotDragRef.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  function handleResizeStart(event: ReactMouseEvent<HTMLDivElement>) {
    resizeDragRef.current = {
      startY: event.clientY,
      originHeight: editorHeight,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const state = resizeDragRef.current;
      if (!state) return;
      const nextHeight = state.originHeight + (moveEvent.clientY - state.startY);
      const viewportMax = window.innerHeight - 320;
      setEditorHeight(Math.min(Math.max(220, nextHeight), viewportMax));
    };

    const handleMouseUp = () => {
      resizeDragRef.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  const showSidebar = sidebarVisible;

  if (loading) {
    return (
      <div className="app-page">
        <div className="app-page-body">
          <div className="surface-card" style={{ padding: 20 }}>
            <Typography.Text>正在加载 SQL分析...</Typography.Text>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <PageToolbar
        left={(
          <>
            <Select
              placeholder="选择开发数据源"
              style={{ width: 240 }}
              value={selectedDatasourceId}
              options={datasources.map((item) => ({ value: item.id, label: `${item.name} (${item.type})` }))}
              onChange={(value) => {
                const nextDatasource = datasources.find((item) => item.id === value);
                setSelectedDatasourceId(value);
                setSelectedDatabase(nextDatasource?.databaseName || "");
                setSelectedScriptId(undefined);
                setSelectedSql("");
                navigate(`/dashboard/data-development/workbench2?datasourceId=${value}`, { replace: true });
              }}
            />
            <Select
              placeholder="选择数据库"
              style={{ width: 220 }}
              value={selectedDatabase || undefined}
              options={databases.map((item) => ({ value: item.name, label: item.name }))}
              disabled={!selectedDatasourceId}
              onChange={handleDatabaseChange}
            />
            <Button icon={<RobotOutlined />} onClick={() => setCopilotOpen(true)} disabled={!selectedDatasourceId}>
              智能辅助
            </Button>
          </>
        )}
        right={(
          <>
            <InputNumber min={1} max={1000} value={resultLimit} onChange={(value) => setResultLimit(Number(value || 200))} />
            <Button onClick={() => setSqlText(formatSql(sqlText, { language: detectSqlLanguage(selectedDatasource?.type) as never }))}>
              格式化
            </Button>
            <Button icon={<SaveOutlined />} onClick={openSaveModal}>
              保存任务
            </Button>
            <Button
              icon={<CalendarOutlined />}
              disabled={!selectedScript}
              loading={creatingSchedule}
              onClick={() => void handleCreateSchedule()}
            >
              创建调度
            </Button>
            <Button type="primary" icon={<PlayCircleOutlined />} loading={executing} onClick={() => void handleExecute()}>
              执行
            </Button>
          </>
        )}
      />

      <div className="app-page-body workspace-page-body">
        <div className="workspace-side-dock">
          <Button
            className="workspace-side-dock__button"
            icon={sidebarVisible ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            title={sidebarVisible ? "隐藏左侧功能区" : "显示左侧功能区"}
            onClick={() => setSidebarVisible((value) => !value)}
          />
        </div>
        <div
          className="workspace-layout workspace-layout--compact"
          style={{ gridTemplateColumns: showSidebar ? "300px minmax(0, 1fr)" : "minmax(0, 1fr)" }}
        >
          {showSidebar ? (
            <aside
              className="workspace-sidebar"
              style={{ gridTemplateRows: "minmax(0,1fr)" }}
            >
              <section className="workspace-sidebar__section workspace-sidebar__section--compact">
                <div className="workspace-sidebar__stack">
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    数据对象树
                  </Typography.Title>
                  <div className="workspace-sidebar__scroll workspace-tree-scroll">
                    {selectedDatasourceId ? (
                      <Tree
                        blockNode
                        className="workspace-object-tree"
                        treeData={objectTreeData}
                        defaultExpandAll
                        onSelect={(keys) => {
                          const key = String(keys[0] || "");
                          if (key.startsWith("table:")) {
                            const [, , tableName] = key.split(":");
                            handleUseTable(tableName);
                          }
                          if (key.startsWith("function:")) {
                            const [, , functionName] = key.split(":");
                            handleUseFunction(functionName);
                          }
                        }}
                      />
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请先选择数据源" />
                    )}
                  </div>
                </div>
              </section>
            </aside>
          ) : null}

          <section className="workspace-panel workspace-panel--resizable">
            <div className="workspace-editor-shell" style={{ minHeight: 0 }}>
              <div className="workspace-panel__section workspace-panel__section--compact workspace-editor" style={{ height: editorHeight }}>
                {selectedDatasourceId ? (
                  <MonacoEditor
                    height="100%"
                    language="sql"
                    value={sqlText}
                    onChange={(value) => setSqlText(value || "")}
                    onMount={(editor) => {
                      editorRef.current = editor;
                      syncSelectedSql();
                      editor.onDidChangeCursorSelection(() => syncSelectedSql());
                      editor.onDidBlurEditorText(() => syncSelectedSql());
                    }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      wordWrap: "off",
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      padding: { top: 12, bottom: 8 },
                    }}
                  />
                ) : (
                  <Empty description="请先选择开发数据源后开始编辑 SQL" />
                )}
              </div>

              <div className="workspace-resize-handle" onMouseDown={handleResizeStart} />

              <div className="workspace-panel__section workspace-panel__section--compact workspace-result-section" style={{ flex: 1 }}>
                <Tabs
                  activeKey={activeResultKey}
                  onChange={setActiveResultKey}
                  className="workspace-tabs"
                  items={resultTabItems}
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <div
        className={`copilot-floating-window${copilotExpanded ? " copilot-floating-window--expanded" : ""}`}
        style={{ left: copilotPosition.x, top: copilotPosition.y, display: copilotOpen ? "flex" : "none" }}
      >
          <div className="copilot-floating-window__header" onMouseDown={handleCopilotDragStart}>
            <div>
              <Space><RobotOutlined /><Typography.Text strong>SQL 智能辅助</Typography.Text></Space>
              <div className="copilot-floating-window__subtitle">持续对话、执行结果分析与 SQL 应用</div>
            </div>
            <Space size={4}>
              <Button
                type="text"
                icon={copilotExpanded ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={() => setCopilotExpanded((current) => !current)}
              />
              <Button
                type="text"
                icon={<CloseOutlined />}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={() => setCopilotOpen(false)}
              />
            </Space>
          </div>
          <div className="copilot-floating-window__body">
            <SqlCopilotPanel
              token={token}
              datasource={selectedDatasource}
              databaseName={selectedDatabase}
              tables={tables}
              editorSql={sqlText}
              selectedSql={selectedSql}
              activeExecution={activeExecution}
              cardless
              onApplySql={handleApplyCopilotSql}
              onExecuteSql={executeSqlText}
              onSaveSql={handleSaveCopilotSql}
            />
          </div>
        </div>

      <Modal
        open={saveModalOpen}
        title={selectedScript ? "更新SQL任务" : "保存为新SQL任务"}
        onCancel={() => setSaveModalOpen(false)}
        onOk={() => void handleSaveScript()}
        confirmLoading={saving}
      >
        <Form layout="vertical" form={saveForm}>
          <Form.Item name="name" label="任务名称" rules={[{ required: true, message: "请输入SQL任务名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Input placeholder="多个标签请用逗号分隔" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
