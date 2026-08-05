import {
  Alert,
  Button,
  Checkbox,
  Collapse,
  Dropdown,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  CheckCircleFilled,
  CloseCircleFilled,
  CopyOutlined,
  DownOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SaveOutlined,
  SearchOutlined,
  SendOutlined,
  StopOutlined,
  TableOutlined,
} from "@ant-design/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchDevSqlCopilotSessionMessages,
  fetchDevSqlCopilotSessions,
  runDevSqlCopilotStream,
} from "../../../services/dataDevelopment";
import type {
  DevDatasourceRecord,
  DevQueryExecutionResult,
  DevSqlCopilotMessage,
  DevSqlCopilotAnalysisDirection,
  DevSqlCopilotProcessStep,
  DevSqlCopilotResponse,
  DevSqlCopilotSession,
  DevSqlCopilotTaskType,
  DevTableEntry,
} from "../../../types/api";

type ApplyMode = "replace_all" | "replace_selection" | "append";

interface SqlCopilotPanelProps {
  token: string | null;
  datasource: DevDatasourceRecord | null;
  databaseName?: string;
  tables?: DevTableEntry[];
  editorSql: string;
  selectedSql: string;
  activeExecution?: {
    title: string;
    sqlText: string;
    result: DevQueryExecutionResult;
  } | null;
  cardless?: boolean;
  onApplySql: (sql: string, mode: ApplyMode) => void;
  onExecuteSql?: (sql: string) => Promise<boolean | void> | boolean | void;
  onSaveSql?: (sql: string) => void;
}

const TASK_OPTIONS: Array<{ value: DevSqlCopilotTaskType; label: string }> = [
  { value: "auto", label: "智能识别" },
  { value: "data_research", label: "数据调研" },
  { value: "generate_sql", label: "生成 SQL" },
  { value: "analyze_sql", label: "分析问题" },
  { value: "rewrite_sql", label: "改写 SQL" },
  { value: "optimize_sql", label: "优化 SQL" },
  { value: "explain_sql", label: "解释 SQL" },
];

const DEFAULT_SUGGESTIONS = [
  "根据当前上下文生成 SQL",
  "检查当前 SQL 是否存在问题",
  "解释当前 SQL 的指标口径",
];

function getPlaceholder(taskType: DevSqlCopilotTaskType, hasExecution: boolean) {
  if (hasExecution) {
    return "可以直接追问当前执行结果，例如：为什么只有这些数据？按省份继续汇总。";
  }
  switch (taskType) {
    case "data_research":
      return "可补充调研重点；不填写时将基于所选表结构与样例数据自动生成分析方向。";
    case "analyze_sql":
      return "描述报错或结果问题，例如：为什么这段 SQL 返回空结果？";
    case "rewrite_sql":
      return "描述修改要求，例如：增加新老用户标识并按省份拆分。";
    case "optimize_sql":
      return "描述优化目标，例如：减少大表扫描并保留现有口径。";
    case "explain_sql":
      return "描述需要解释的重点，例如：说明指标口径和结果粒度。";
    default:
      return "输入问题或需求，可基于历史回答继续追问。";
  }
}

function taskLabel(taskType?: string | null) {
  return TASK_OPTIONS.find((item) => item.value === taskType)?.label || "智能识别";
}

function compactText(value: string, maxLength = 80) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}

function formatAnalysisDirection(direction: DevSqlCopilotAnalysisDirection) {
  const blocks = [
    `请围绕“${direction.title}”开展分析。`,
    `业务问题：${direction.businessQuestion}`,
    direction.analysisObject ? `分析对象：${direction.analysisObject}` : "",
    direction.dimensions.length ? `分析维度：${direction.dimensions.join("、")}` : "",
    direction.metrics.length ? `核心指标：${direction.metrics.join("、")}` : "",
    direction.statisticalScope ? `统计口径：${direction.statisticalScope}` : "",
    direction.sourceFields.length ? `数据依据：${direction.sourceFields.join("、")}` : "",
    direction.businessValue ? `业务价值：${direction.businessValue}` : "",
  ];
  return blocks.filter(Boolean).join("\n");
}

function buildLegacyAnalysisDirections(values: string[]): DevSqlCopilotAnalysisDirection[] {
  return values.slice(0, 3).map((value, index) => {
    const clean = String(value || "").replace(/\*\*/g, "").trim();
    const title = clean.split(/[：:]/, 1)[0] || `分析方向 ${index + 1}`;
    return {
      title,
      businessQuestion: clean,
      analysisObject: "",
      dimensions: [],
      metrics: [],
      statisticalScope: "",
      sourceFields: [],
      businessValue: "",
    };
  });
}

function renderStringGroup(title: string, values: string[], color: string) {
  if (!values.length) return null;
  return (
    <div className="sql-copilot-detail-group">
      <Typography.Text strong>{title}</Typography.Text>
      <div className="sql-copilot-tag-list">
        {values.map((item) => <Tag key={`${title}-${item}`} color={color}>{item}</Tag>)}
      </div>
    </div>
  );
}

function ProcessSteps({ steps, running }: { steps: DevSqlCopilotProcessStep[]; running?: boolean }) {
  if (!steps.length && !running) return null;
  return (
    <Collapse
      ghost
      size="small"
      className="sql-copilot-process"
      items={[{
        key: "process",
        label: (
          <Space size={8}>
            {running ? <Spin size="small" /> : null}
            <span>处理过程{steps.length ? `（${steps.length}步）` : ""}</span>
          </Space>
        ),
        children: (
          <div className="sql-copilot-process-list">
            {steps.map((step, index) => (
              <div key={`${step.phase}-${index}`} className="sql-copilot-process-step">
                <span className="sql-copilot-process-index">{index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  {step.detail ? <p>{step.detail}</p> : null}
                </div>
              </div>
            ))}
            {!steps.length ? <Typography.Text type="secondary">正在准备上下文…</Typography.Text> : null}
          </div>
        ),
      }]}
    />
  );
}

export function SqlCopilotPanel({
  token,
  datasource,
  databaseName,
  tables = [],
  editorSql,
  selectedSql,
  activeExecution,
  cardless = false,
  onApplySql,
  onExecuteSql,
  onSaveSql,
}: SqlCopilotPanelProps) {
  const [taskType, setTaskType] = useState<DevSqlCopilotTaskType>("auto");
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [executingMessageId, setExecutingMessageId] = useState<number | null>(null);
  const [messages, setMessages] = useState<DevSqlCopilotMessage[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<DevSqlCopilotSession[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [draftSelectedTables, setDraftSelectedTables] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messageViewportRef = useRef<HTMLDivElement | null>(null);

  const filteredTables = useMemo(() => {
    const keyword = tableSearch.trim().toLowerCase();
    if (!keyword) return tables;
    return tables.filter((item) => (
      item.name.toLowerCase().includes(keyword)
      || String(item.comment || "").toLowerCase().includes(keyword)
    ));
  }, [tableSearch, tables]);

  const selectedTableSummary = useMemo(() => (
    selectedTables.length ? selectedTables.join("、") : "自动识别相关表"
  ), [selectedTables]);

  const selectedSqlLineCount = useMemo(
    () => (selectedSql ? selectedSql.split(/\r?\n/).length : 0),
    [selectedSql]
  );

  const latestResult = useMemo(() => (
    [...messages].reverse().find((item) => item.role === "assistant" && item.payload?.result)?.payload?.result || null
  ), [messages]);

  const suggestions = latestResult?.taskType === "data_research"
    ? ["把第一个方向生成 SQL", "继续补充可分析指标", "说明这些方向的业务价值"]
    : latestResult?.suggestions?.length
      ? latestResult.suggestions.slice(0, 3)
    : DEFAULT_SUGGESTIONS;

  const canRun = Boolean(datasource?.id)
    && (taskType !== "data_research" || selectedTables.length > 0)
    && Boolean(prompt.trim() || selectedSql.trim() || editorSql.trim() || activeExecution || selectedTables.length);

  async function refreshSessions() {
    if (!token) return;
    try {
      const response = await fetchDevSqlCopilotSessions(token);
      setSessions(response.data || []);
    } catch {
      setSessions([]);
    }
  }

  useEffect(() => {
    void refreshSessions();
  }, [token]);

  useEffect(() => {
    const validTables = new Set(tables.map((item) => item.name));
    setSelectedTables((current) => current.filter((item) => validTables.has(item)));
  }, [tables]);

  useEffect(() => {
    setMessages([]);
    setSessionId(null);
    setHistoryOpen(false);
  }, [datasource?.id, databaseName]);

  useEffect(() => {
    const viewport = messageViewportRef.current;
    if (!viewport || historyOpen) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [historyOpen, messages, running]);

  function handleNewSession() {
    abortControllerRef.current?.abort();
    setMessages([]);
    setSessionId(null);
    setPrompt("");
    setHistoryOpen(false);
  }

  async function openHistorySession(nextSessionId: number) {
    if (!token) return;
    setHistoryLoading(true);
    try {
      const response = await fetchDevSqlCopilotSessionMessages(token, nextSessionId);
      setSessionId(response.data.session.id);
      setMessages(response.data.messages || []);
      setHistoryOpen(false);
    } catch (error: any) {
      message.error(error.message || "加载历史会话失败");
    } finally {
      setHistoryLoading(false);
    }
  }

  function updateStreamingMessage(messageId: number, updater: (message: DevSqlCopilotMessage) => DevSqlCopilotMessage) {
    setMessages((current) => current.map((item) => (item.id === messageId ? updater(item) : item)));
  }

  async function handleRun(rawPrompt?: string) {
    if (!token || !datasource?.id) {
      message.warning("请先选择开发数据源");
      return;
    }
    const nextPrompt = String(rawPrompt ?? prompt).trim();
    if (taskType === "data_research" && !selectedTables.length) {
      message.warning("数据调研请至少选择 1 张表");
      return;
    }
    const isTableOnlyResearch = selectedTables.length > 0
      && !nextPrompt
      && ["auto", "data_research"].includes(taskType);
    if (!nextPrompt && !selectedSql.trim() && !editorSql.trim() && !activeExecution && !selectedTables.length) {
      message.warning("请输入问题，或者提供表范围、SQL、执行结果上下文");
      return;
    }

    const localId = Date.now();
    const localUserMessage: DevSqlCopilotMessage = {
      id: localId,
      sessionId: sessionId || 0,
      role: "user",
      taskType: taskType === "auto" ? null : taskType,
      messageText: nextPrompt || (isTableOnlyResearch
        ? `请基于已选 ${selectedTables.length} 张表的结构与样例数据开展数据调研。`
        : "请基于当前 SQL 上下文继续处理。"),
      payload: null,
      context: {
        datasourceId: datasource.id,
        databaseName: databaseName || datasource.databaseName,
        selectedTables,
        activeExecutionHistoryId: isTableOnlyResearch ? null : activeExecution?.result.historyId || null,
        hasSelectedSql: !isTableOnlyResearch && Boolean(selectedSql),
        hasEditorSql: !isTableOnlyResearch && Boolean(editorSql),
      },
      createdAt: new Date().toISOString(),
    };
    const placeholderId = localId + 1;
    const localAssistantMessage: DevSqlCopilotMessage = {
      id: placeholderId,
      sessionId: sessionId || 0,
      role: "assistant",
      taskType: null,
      messageText: "正在准备上下文…",
      payload: { processSteps: [] },
      context: localUserMessage.context,
      createdAt: new Date().toISOString(),
    };

    const abortController = new AbortController();
    let deltaStarted = false;
    abortControllerRef.current = abortController;
    setMessages((current) => [...current, localUserMessage, localAssistantMessage]);
    setPrompt("");
    setRunning(true);
    setHistoryOpen(false);

    try {
      await runDevSqlCopilotStream(
        token,
        {
          sessionId: sessionId || undefined,
          datasourceId: datasource.id,
          databaseName: databaseName || datasource.databaseName,
          taskType,
          prompt: nextPrompt,
          selectedSql: isTableOnlyResearch ? undefined : selectedSql || undefined,
          editorSql: isTableOnlyResearch ? undefined : editorSql || undefined,
          errorMessage: !isTableOnlyResearch && activeExecution?.result.status === "failed" ? activeExecution.result.errorMessage : undefined,
          activeExecutionHistoryId: isTableOnlyResearch ? undefined : activeExecution?.result.historyId || undefined,
          selectedTables: selectedTables.length ? selectedTables : undefined,
        },
        {
          onSession: (data) => {
            setSessionId(data.sessionId);
            setMessages((current) => current.map((item) => (
              item.id === localId || item.id === placeholderId ? { ...item, sessionId: data.sessionId } : item
            )));
          },
          onProgress: (step) => {
            updateStreamingMessage(placeholderId, (item) => ({
              ...item,
              messageText: step.detail || step.title,
              payload: {
                ...(item.payload || {}),
                processSteps: [...(item.payload?.processSteps || []), step],
              },
            }));
          },
          onDelta: () => {
            if (deltaStarted) return;
            deltaStarted = true;
            updateStreamingMessage(placeholderId, (item) => ({ ...item, messageText: "正在生成回答…" }));
          },
          onDone: (data) => {
            setSessionId(data.sessionId || null);
            const completedMessage = data.assistantMessage || {
              ...localAssistantMessage,
              sessionId: data.sessionId || 0,
              taskType: data.result.taskType === "auto" ? null : data.result.taskType,
              messageText: data.result.explanation || data.result.summary,
              payload: { result: data.result, processSteps: localAssistantMessage.payload?.processSteps || [] },
            };
            setMessages((current) => current.map((item) => (item.id === placeholderId ? completedMessage : item)));
          },
        },
        { signal: abortController.signal }
      );
      void refreshSessions();
    } catch (error: any) {
      if (error?.name === "AbortError") {
        message.info("已停止生成");
      } else {
        message.error(error.message || "智能辅助调用失败");
      }
      setMessages((current) => current.filter((item) => item.id !== placeholderId));
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setRunning(false);
    }
  }

  function handleSelectedTablesChange(values: string[]) {
    if (values.length > 5) {
      message.warning("最多选择 5 张表");
      setSelectedTables(values.slice(0, 5));
      return;
    }
    setSelectedTables(values);
  }

  function openTablePicker() {
    setDraftSelectedTables(selectedTables);
    setTableSearch("");
    setTablePickerOpen(true);
  }

  function toggleDraftTable(tableName: string) {
    setDraftSelectedTables((current) => {
      if (current.includes(tableName)) {
        return current.filter((item) => item !== tableName);
      }
      if (current.length >= 5) {
        message.warning("最多选择 5 张表");
        return current;
      }
      return [...current, tableName];
    });
  }

  function confirmTablePicker() {
    handleSelectedTablesChange(draftSelectedTables);
    setTablePickerOpen(false);
  }

  async function handleCopy(sql: string) {
    await navigator.clipboard.writeText(sql);
    message.success("SQL 已复制");
  }

  async function handleExecute(messageId: number, sql: string) {
    if (!onExecuteSql) return;
    setExecutingMessageId(messageId);
    try {
      const succeeded = await onExecuteSql(sql);
      if (succeeded === false) {
        message.warning("SQL 执行未通过，请查看SQL分析执行结果并继续追问");
      } else {
        message.success("SQL 执行成功，可在SQL分析执行结果中查看");
      }
    } finally {
      setExecutingMessageId(null);
    }
  }

  function renderAssistantMessage(item: DevSqlCopilotMessage) {
    const result = item.payload?.result;
    const processSteps = item.payload?.processSteps || [];
    if (!result) {
      return (
        <div className="sql-copilot-assistant-card sql-copilot-assistant-card--streaming">
          <ProcessSteps steps={processSteps} running={running && item.id === messages[messages.length - 1]?.id} />
          <Typography.Text type="secondary">{item.messageText}</Typography.Text>
        </div>
      );
    }

    const defaultMode: ApplyMode = selectedSql ? "replace_selection" : "replace_all";
    const researchDirections = result.taskType === "data_research"
      ? (result.analysisDirections?.length
        ? result.analysisDirections.slice(0, 3)
        : buildLegacyAnalysisDirections(result.suggestions))
      : [];
    const applyItems = [
      { key: "replace_all", label: "覆盖编辑器全部 SQL" },
      { key: "replace_selection", label: "替换当前选中 SQL", disabled: !selectedSql },
      { key: "append", label: "追加到编辑器末尾" },
    ];
    const detailChildren = (
      <div className="sql-copilot-details">
        {result.diagnostics.length ? (
          <div className="sql-copilot-detail-group">
            <Typography.Text strong>问题诊断</Typography.Text>
            {result.diagnostics.map((diagnostic, index) => (
              <Alert
                key={`${diagnostic.title}-${index}`}
                type={diagnostic.severity === "high" ? "error" : diagnostic.severity === "medium" ? "warning" : "info"}
                showIcon
                message={diagnostic.title}
                description={diagnostic.detail}
              />
            ))}
          </div>
        ) : null}
        {result.usedTables.length ? (
          <div className="sql-copilot-detail-group">
            <Typography.Text strong>使用到的表</Typography.Text>
            {result.usedTables.map((table) => (
              <div key={table.tableName} className="sql-copilot-used-table">
                <Tag color="blue">{table.tableName}</Tag>
                <span>{table.reason}</span>
                {table.columns.length ? <small>{table.columns.join("、")}</small> : null}
              </div>
            ))}
          </div>
        ) : null}
        {result.sampledTables.length ? (
          <div className="sql-copilot-detail-group">
            <Typography.Text strong>样本依据</Typography.Text>
            {result.sampledTables.map((table) => (
              <Alert
                key={table.tableName}
                type={table.sampleError ? "warning" : "info"}
                showIcon
                message={`${table.tableName} · ${table.rowCount} 行样本`}
                description={table.sampleError || `采样字段：${table.columns.join("、")}`}
              />
            ))}
          </div>
        ) : null}
        {renderStringGroup("关键假设", result.assumptions || [], "gold")}
        {renderStringGroup("风险提示", result.risks || [], "red")}
      </div>
    );

    return (
      <div className="sql-copilot-assistant-card">
        <div className="sql-copilot-answer-head">
          <Tag color="blue">{taskLabel(result.taskType)}</Tag>
          <Typography.Text type="secondary">{result.provider.configName} / {result.provider.modelName}</Typography.Text>
        </div>
        <ProcessSteps steps={processSteps} />
        <Typography.Title level={5} className="sql-copilot-result-title">{result.summary}</Typography.Title>
        <Typography.Paragraph className="sql-copilot-explanation">{result.explanation}</Typography.Paragraph>

        {researchDirections.length ? (
          <div className="sql-copilot-research-directions">
            <div className="sql-copilot-research-title">
              <Typography.Text strong>建议分析方向</Typography.Text>
              <Tag color="blue">{researchDirections.length} 条</Tag>
            </div>
            {researchDirections.map((direction, index) => (
              <button
                key={`${direction.title}-${index}`}
                type="button"
                className="sql-copilot-research-direction"
                onClick={() => {
                  setPrompt(formatAnalysisDirection(direction));
                }}
              >
                <span className="sql-copilot-research-direction-index">{index + 1}</span>
                <span className="sql-copilot-research-direction-content">
                  <strong>{direction.title}</strong>
                  <span>{direction.businessQuestion}</span>
                  {direction.analysisObject ? <small><b>分析对象</b>{direction.analysisObject}</small> : null}
                  {direction.dimensions.length ? <small><b>分析维度</b>{direction.dimensions.join("、")}</small> : null}
                  {direction.metrics.length ? <small><b>核心指标</b>{direction.metrics.join("、")}</small> : null}
                  {direction.statisticalScope ? <small><b>统计口径</b>{direction.statisticalScope}</small> : null}
                  {direction.sourceFields.length ? <small><b>数据依据</b>{direction.sourceFields.join("、")}</small> : null}
                  {direction.businessValue ? <small><b>业务价值</b>{direction.businessValue}</small> : null}
                  <em>点击同步到输入框</em>
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {result.activeExecution ? (
          <div className="sql-copilot-evidence">
            已依据执行结果 #{result.activeExecution.historyId}：{result.activeExecution.status === "success"
              ? `${result.activeExecution.rowCount} 行、${result.activeExecution.fields.length} 个字段`
              : result.activeExecution.errorMessage || "执行失败"}
          </div>
        ) : null}

        {result.generatedSql ? (
          <div className="sql-copilot-sql-card">
            <div className="sql-copilot-sql-head">
              <Typography.Text strong>建议 SQL</Typography.Text>
              {result.validation ? (
                <Tag color={result.validation.valid ? "success" : "warning"}>
                  {result.validation.valid ? "校验通过" : "存在风险"}
                </Tag>
              ) : null}
            </div>
            <pre><code>{result.generatedSql}</code></pre>
            {result.validation?.messages?.length ? (
              <Typography.Text type="secondary" className="sql-copilot-validation-text">
                {result.validation.messages.join("；")}
              </Typography.Text>
            ) : null}
            <div className="sql-copilot-result-actions">
              <Space.Compact>
                <Button type="primary" onClick={() => onApplySql(result.generatedSql, defaultMode)}>
                  {defaultMode === "replace_selection" ? "替换选中 SQL" : "应用到编辑器"}
                </Button>
                <Dropdown
                  menu={{
                    items: applyItems,
                    onClick: ({ key }) => onApplySql(result.generatedSql, key as ApplyMode),
                  }}
                >
                  <Button type="primary" icon={<DownOutlined />} aria-label="更多应用方式" />
                </Dropdown>
              </Space.Compact>
              {onExecuteSql ? (
                <Button
                  icon={<PlayCircleOutlined />}
                  loading={executingMessageId === item.id}
                  onClick={() => void handleExecute(item.id, result.generatedSql)}
                >
                  执行验证
                </Button>
              ) : null}
              <Tooltip title="复制 SQL">
                <Button icon={<CopyOutlined />} onClick={() => void handleCopy(result.generatedSql)} />
              </Tooltip>
              {onSaveSql ? (
                <Tooltip title="保存为SQL任务">
                  <Button icon={<SaveOutlined />} onClick={() => onSaveSql(result.generatedSql)} />
                </Tooltip>
              ) : null}
            </div>
          </div>
        ) : null}

        <Collapse
          ghost
          size="small"
          className="sql-copilot-detail-collapse"
          items={[{ key: "details", label: "查看表范围、诊断与风险", children: detailChildren }]}
        />
      </div>
    );
  }

  const content = (
    <div className="sql-copilot-chat">
      <div className="sql-copilot-toolbar">
        <div className="sql-copilot-context-summary">
          <Tag color="blue">{datasource?.name || "未选择数据源"}{databaseName ? ` / ${databaseName}` : ""}</Tag>
          <Tag>{taskType === "auto" ? "任务自动识别" : taskLabel(taskType)}</Tag>
          <Tag>{selectedTables.length ? `表范围 ${selectedTables.length}` : "表范围自动"}</Tag>
          {selectedSql ? <Tag color="cyan">选中 SQL {selectedSqlLineCount} 行</Tag> : null}
        </div>
        <Space size={4}>
          <Tooltip title="新会话"><Button type="text" icon={<PlusOutlined />} onClick={handleNewSession} /></Tooltip>
          <Tooltip title="历史会话">
            <Button
              type={historyOpen ? "primary" : "text"}
              icon={<HistoryOutlined />}
              onClick={() => {
                setHistoryOpen((current) => !current);
                void refreshSessions();
              }}
            />
          </Tooltip>
        </Space>
      </div>

      {historyOpen ? (
        <div className="sql-copilot-history">
          <Typography.Title level={5}>历史会话</Typography.Title>
          {historyLoading ? <Spin /> : null}
          {!historyLoading && !sessions.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无历史会话" /> : null}
          <div className="sql-copilot-history-list">
            {sessions.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`sql-copilot-history-item${item.id === sessionId ? " is-active" : ""}`}
                onClick={() => void openHistorySession(item.id)}
              >
                <strong>{item.sessionTitle || `会话 ${item.id}`}</strong>
                <span>{compactText(item.lastPreview || "暂无消息摘要", 70)}</span>
                <small>{item.datasourceName}{item.databaseName ? ` / ${item.databaseName}` : ""} · {item.messageCount || 0} 条消息</small>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="sql-copilot-message-list" ref={messageViewportRef}>
          {!messages.length ? (
            <div className="sql-copilot-empty">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={datasource
                  ? "选择表后可直接开展数据调研，也可以生成、改写、优化、解释 SQL 或追问执行结果。"
                  : "选择数据源后即可使用智能辅助。"}
              />
            </div>
          ) : null}
          {messages.map((item) => (
            <div key={`${item.role}-${item.id}`} className={`sql-copilot-message sql-copilot-message--${item.role}`}>
              {item.role === "user" ? (
                <div className="sql-copilot-user-bubble">
                  <div>{item.messageText}</div>
                  <div className="sql-copilot-message-context">
                    {item.context?.selectedTables?.length ? `表范围 ${item.context.selectedTables.length} · ` : ""}
                    {item.context?.activeExecutionHistoryId ? `执行结果 #${item.context.activeExecutionHistoryId}` : ""}
                  </div>
                </div>
              ) : renderAssistantMessage(item)}
            </div>
          ))}
        </div>
      )}

      <div className="sql-copilot-composer">
        <div className="sql-copilot-suggestions">
          {suggestions.map((item) => (
            <button key={item} type="button" disabled={running} onClick={() => void handleRun(item)}>{compactText(item, 28)}</button>
          ))}
        </div>
        <div className="sql-copilot-composer-controls">
          <label className="sql-copilot-control-field">
            <span>任务类型</span>
            <Select
              value={taskType}
              options={TASK_OPTIONS}
              onChange={setTaskType}
              style={{ width: 126 }}
            />
          </label>
          <div className="sql-copilot-control-field sql-copilot-control-field--tables">
            <span>表范围</span>
            <Tooltip title={selectedTableSummary} placement="topLeft">
              <button type="button" className="sql-copilot-table-picker-trigger" onClick={openTablePicker}>
                <TableOutlined />
                <span>{selectedTables.length ? `已选 ${selectedTables.length} 张表` : "自动识别相关表"}</span>
                <small>选择</small>
              </button>
            </Tooltip>
          </div>
        </div>
        {activeExecution ? (
          <div className={`sql-copilot-execution-context sql-copilot-execution-context--${activeExecution.result.status}`}>
            <div className="sql-copilot-execution-icon">
              {activeExecution.result.status === "success" ? <CheckCircleFilled /> : <CloseCircleFilled />}
            </div>
            <div className="sql-copilot-execution-main">
              <div className="sql-copilot-execution-title">
                <strong>已关联执行结果</strong>
                <span>{activeExecution.title}</span>
              </div>
              {activeExecution.result.status === "success" ? (
                <div className="sql-copilot-execution-metrics">
                  <span><b>{activeExecution.result.rowCount}</b> 行</span>
                  <span><b>{activeExecution.result.fields.length}</b> 个字段</span>
                  <span><b>{activeExecution.result.durationMs}</b> ms</span>
                </div>
              ) : (
                <div className="sql-copilot-execution-error">
                  {compactText(activeExecution.result.errorMessage || "SQL 执行失败", 110)}
                </div>
              )}
            </div>
            <span className="sql-copilot-execution-hint">回答将参考此结果</span>
          </div>
        ) : null}
        <div className="sql-copilot-input-row">
          <Input.TextArea
            value={prompt}
            autoSize={{ minRows: 4, maxRows: 8 }}
            placeholder={getPlaceholder(taskType, Boolean(activeExecution))}
            disabled={!datasource}
            onChange={(event) => setPrompt(event.target.value)}
            onPressEnter={(event) => {
              if (!event.shiftKey) {
                event.preventDefault();
                if (!running) void handleRun();
              }
            }}
          />
          {running ? (
            <Button className="sql-copilot-send-button" danger icon={<StopOutlined />} onClick={() => abortControllerRef.current?.abort()}>停止</Button>
          ) : (
            <Button className="sql-copilot-send-button" type="primary" icon={<SendOutlined />} disabled={!canRun} onClick={() => void handleRun()}>发送</Button>
          )}
        </div>

        <Modal
          open={tablePickerOpen}
          title="选择数据调研与 SQL 上下文表"
          width={720}
          className="sql-copilot-table-picker-modal"
          onCancel={() => setTablePickerOpen(false)}
          footer={[
            <Button key="clear" onClick={() => setDraftSelectedTables([])}>清空选择</Button>,
            <Button key="cancel" onClick={() => setTablePickerOpen(false)}>取消</Button>,
            <Button key="confirm" type="primary" onClick={confirmTablePicker}>
              确定{draftSelectedTables.length ? `（${draftSelectedTables.length}）` : ""}
            </Button>,
          ]}
        >
          <div className="sql-copilot-table-picker-head">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              value={tableSearch}
              placeholder="搜索表名或表注释"
              onChange={(event) => setTableSearch(event.target.value)}
            />
            <Typography.Text type="secondary">
              共 {tables.length} 张表，最多选择 5 张，已选 {draftSelectedTables.length} 张
            </Typography.Text>
          </div>
          <div className="sql-copilot-table-picker-list">
            {filteredTables.map((item) => {
              const checked = draftSelectedTables.includes(item.name);
              return (
                <div
                  key={item.name}
                  className={`sql-copilot-table-picker-item${checked ? " is-selected" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleDraftTable(item.name)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") toggleDraftTable(item.name);
                  }}
                >
                  <Checkbox
                    checked={checked}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => toggleDraftTable(item.name)}
                  />
                  <div className="sql-copilot-table-picker-copy">
                    <Typography.Text strong>{item.name}</Typography.Text>
                    <Typography.Text type="secondary">{item.comment || "暂无表注释"}</Typography.Text>
                  </div>
                  <Tag>{item.type || "TABLE"}</Tag>
                </div>
              );
            })}
            {!filteredTables.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到匹配的表" /> : null}
          </div>
        </Modal>
      </div>
    </div>
  );

  if (cardless) return content;
  return <div className="sql-copilot-card">{content}</div>;
}
