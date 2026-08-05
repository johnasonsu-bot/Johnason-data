import {
  CloseOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  HistoryOutlined,
  LoadingOutlined,
  MessageOutlined,
  ReloadOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { App, Button, Empty, Input, Spin, Tag } from "antd";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  fetchQualityOpsRobotSessionMessages,
  fetchQualityOpsRobotSessions,
  queryQualityOpsRobot,
  type QualityOpsRobotCard,
  type QualityOpsRobotMessage,
  type QualityOpsRobotSession,
} from "../../services/qualityControl";
import "../data-ingestion-monitor/ingestionOpsRobot.css";
import "./qualityOpsRobot.css";

const PANEL_WIDTH = 430;
const PANEL_HEIGHT = 640;
const PANEL_WIDTH_EXPANDED = 640;
const PANEL_HEIGHT_EXPANDED = 780;
const DEFAULT_SUGGESTIONS = ["查看系统质量排名", "哪些表问题最多", "当前待确认异常"];

const COLUMN_LABELS: Record<string, string> = {
  systemName: "系统",
  tableName: "数据表",
  score: "质量得分",
  issueRows: "问题行",
  tableCount: "纳管表",
  ruleCode: "规则",
  ruleCategory: "规则类别",
  issueRate: "问题率",
  fieldName: "字段",
  severity: "级别",
};

function clampPosition(left: number, top: number) {
  const width = typeof window === "undefined" ? 1440 : window.innerWidth;
  const height = typeof window === "undefined" ? 900 : window.innerHeight;
  return { left: Math.max(12, Math.min(left, width - 72)), top: Math.max(12, Math.min(top, height - 72)) };
}

function getDefaultPosition() {
  if (typeof window === "undefined") return { left: 0, top: 0 };
  return clampPosition(window.innerWidth - 92, window.innerHeight - 116);
}

function formatTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function formatCardValue(column: string, value: unknown) {
  if (column === "severity") {
    return ({ critical: "紧急", high: "高", medium: "中", low: "低" } as Record<string, string>)[String(value || "")] || "-";
  }
  const text = String(value ?? "-");
  return text.length > 100 ? `${text.slice(0, 100)}...` : text;
}

function renderCard(card: QualityOpsRobotCard, index: number) {
  if (card.type === "stats") {
    return (
      <div key={`${card.title}-${index}`} className="ops-robot-card ops-robot-card--stats">
        <div className="ops-robot-card__title">{card.title}</div>
        <div className="ops-robot-stats-grid">
          {(card.items || []).map((item) => (
            <div key={`${card.title}-${item.label}`} className="ops-robot-stat-item">
              <span>{item.label}</span>
              <strong>{String(item.value ?? "-")}</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const columns = (card.columns || []).slice(0, 4);
  return (
    <div key={`${card.title}-${index}`} className="ops-robot-card ops-robot-card--table">
      <div className="ops-robot-card__header">
        <div className="ops-robot-card__title">{card.title}</div>
        {(card.columns || []).length > columns.length ? <div className="ops-robot-card__meta">聚焦展示 {columns.length} 项</div> : null}
      </div>
      <div className="ops-robot-record-list">
        {(card.rows || []).slice(0, 6).map((row, rowIndex) => (
          <div key={`${card.title}-${rowIndex}`} className="ops-robot-record">
            {columns.map((column) => (
              <div key={`${column}-${rowIndex}`} className="ops-robot-record__field">
                <span className="ops-robot-record__label">{COLUMN_LABELS[column] || column}</span>
                <strong className="ops-robot-record__value">{formatCardValue(column, row[column])}</strong>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function QualityOpsRobot() {
  const { message } = App.useApp();
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(false);
  const [messages, setMessages] = useState<QualityOpsRobotMessage[]>([]);
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [historySessions, setHistorySessions] = useState<QualityOpsRobotSession[]>([]);
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS);
  const [position, setPosition] = useState(getDefaultPosition);
  const floatRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({ active: false, offsetX: 0, offsetY: 0, startX: 0, startY: 0 });
  const draggedRef = useRef(false);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!dragRef.current.active) return;
      if (Math.abs(event.clientX - dragRef.current.startX) + Math.abs(event.clientY - dragRef.current.startY) > 4) draggedRef.current = true;
      setPosition(clampPosition(event.clientX - dragRef.current.offsetX, event.clientY - dragRef.current.offsetY));
    };
    const handleUp = () => {
      dragRef.current.active = false;
      window.setTimeout(() => { draggedRef.current = false; }, 0);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  useEffect(() => {
    if (!open || !token) return;
    void refreshHistory(token);
  }, [open, token]);

  useEffect(() => {
    if (!viewportRef.current) return;
    viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }, [messages, loading, open]);

  function beginDrag(event: ReactMouseEvent<HTMLElement>) {
    if (event.button !== 0) return;
    const rect = floatRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    draggedRef.current = false;
    dragRef.current = {
      active: true,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  function stopDrag(event: ReactMouseEvent<HTMLElement>) {
    event.stopPropagation();
  }

  async function refreshHistory(activeToken = token) {
    if (!activeToken) return;
    try {
      const response = await fetchQualityOpsRobotSessions(activeToken);
      setHistorySessions(response.data.sessions || []);
    } catch {
      setHistorySessions([]);
    }
  }

  async function openHistorySession(nextSessionId: number) {
    if (!token) return;
    setBooting(true);
    try {
      const response = await fetchQualityOpsRobotSessionMessages(token, nextSessionId);
      setSessionId(response.data.session.id);
      setMessages(response.data.messages || []);
      const latestAssistant = [...(response.data.messages || [])].reverse().find((item) => item.role === "assistant");
      setSuggestions(latestAssistant?.payload?.suggestions?.length ? latestAssistant.payload.suggestions : DEFAULT_SUGGESTIONS);
      setHistoryOpen(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "历史会话加载失败");
    } finally {
      setBooting(false);
    }
  }

  function resetSession() {
    setMessages([]);
    setSessionId(undefined);
    setInputValue("");
    setHistoryOpen(false);
    setSuggestions(DEFAULT_SUGGESTIONS);
    void refreshHistory(token);
  }

  async function sendMessage(rawText: string) {
    const question = rawText.trim();
    if (!question || !token || loading) return;
    const localUserMessage: QualityOpsRobotMessage = {
      id: Date.now(),
      sessionId: sessionId || 0,
      role: "user",
      messageText: question,
      payload: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, localUserMessage]);
    setInputValue("");
    setLoading(true);
    setHistoryOpen(false);
    try {
      const response = await queryQualityOpsRobot(token, { question, sessionId });
      const nextSessionId = response.data.sessionId;
      setSessionId(nextSessionId);
      setMessages((current) => [
        ...current.slice(0, -1),
        { ...localUserMessage, sessionId: nextSessionId },
        response.data.assistantMessage,
      ]);
      const nextSuggestions = response.data.assistantMessage.payload?.suggestions;
      if (nextSuggestions?.length) setSuggestions(nextSuggestions);
      void refreshHistory(token);
    } catch (error) {
      setMessages((current) => current.filter((item) => item.id !== localUserMessage.id));
      message.error(error instanceof Error ? error.message : "质量运营助手查询失败");
    } finally {
      setLoading(false);
    }
  }

  const panelStyle = {
    width: panelExpanded ? PANEL_WIDTH_EXPANDED : PANEL_WIDTH,
    height: panelExpanded ? PANEL_HEIGHT_EXPANDED : PANEL_HEIGHT,
  };

  return (
    <div ref={floatRef} className={`ops-robot-float quality-ops-robot${open ? " ops-robot-float--open" : ""}`} style={{ left: position.left, top: position.top }}>
      <div className="ops-robot-trigger" onMouseDown={beginDrag}>
        <button
          type="button"
          className="ops-robot-trigger__button"
          aria-label="打开质量运营助手"
          onClick={(event) => {
            event.stopPropagation();
            if (draggedRef.current) return;
            setOpen((current) => !current);
          }}
        >
          <span className="ops-robot-avatar" aria-hidden="true">
            <span className="ops-robot-avatar__halo" /><span className="ops-robot-avatar__shadow" /><span className="ops-robot-avatar__antenna" />
            <span className="ops-robot-avatar__head"><span className="ops-robot-avatar__visor" /><span className="ops-robot-avatar__eye ops-robot-avatar__eye--left" /><span className="ops-robot-avatar__eye ops-robot-avatar__eye--right" /><span className="ops-robot-avatar__mouth" /><span className="ops-robot-avatar__cheek ops-robot-avatar__cheek--left" /><span className="ops-robot-avatar__cheek ops-robot-avatar__cheek--right" /></span>
            <span className="ops-robot-avatar__body" /><span className="ops-robot-avatar__arm ops-robot-avatar__arm--left" /><span className="ops-robot-avatar__arm ops-robot-avatar__arm--right" />
          </span>
        </button>
      </div>

      {open ? (
        <div className={`ops-robot-panel quality-ops-robot__panel${panelExpanded ? " ops-robot-panel--expanded" : ""}`} style={panelStyle}>
          <div className="ops-robot-panel__header" onMouseDown={beginDrag}>
            <div>
              <div className="ops-robot-panel__title">质量运营助手 <Tag color="green">只读</Tag></div>
              <div className="ops-robot-panel__subtitle">连续追问质量结果、异常、规则与治理重点</div>
            </div>
            <div className="ops-robot-panel__actions">
              <Button size="small" type="text" title="新会话" icon={<ReloadOutlined />} onMouseDown={stopDrag} onClick={(event) => { event.stopPropagation(); resetSession(); }} />
              <Button size="small" type="text" title="历史问题" icon={<HistoryOutlined />} onMouseDown={stopDrag} onClick={(event) => { event.stopPropagation(); setHistoryOpen((current) => !current); void refreshHistory(token); }} />
              <Button size="small" type="text" title={panelExpanded ? "还原" : "展开"} icon={panelExpanded ? <FullscreenExitOutlined /> : <FullscreenOutlined />} onMouseDown={stopDrag} onClick={(event) => { event.stopPropagation(); setPanelExpanded((current) => !current); }} />
              <Button size="small" type="text" title="关闭" icon={<CloseOutlined />} onMouseDown={stopDrag} onClick={(event) => { event.stopPropagation(); setOpen(false); setHistoryOpen(false); }} />
            </div>
          </div>

          {historyOpen ? (
            <div className="ops-robot-history">
              <div className="ops-robot-history__head">历史问题</div>
              <div className="ops-robot-history__list">
                {historySessions.length === 0 ? <div className="ops-robot-history__empty">暂无历史问题</div> : historySessions.map((item) => (
                  <button key={item.id} type="button" className={`ops-robot-history__item${item.id === sessionId ? " is-active" : ""}`} onClick={() => void openHistorySession(item.id)}>
                    <strong>{item.sessionTitle || `会话 ${item.id}`}</strong>
                    <span>{item.lastPreview || "暂无回答摘要"}</span>
                    <em>{formatTime(item.lastMessageAt || item.updatedAt || item.createdAt)}</em>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="ops-robot-panel__body" ref={viewportRef}>
            {booting ? <div className="ops-robot-loading"><Spin indicator={<LoadingOutlined spin />} /></div> : null}
            {!booting && messages.length === 0 ? (
              <div className="ops-robot-empty">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="可以查询质量排名、重点问题、异常和规则，并围绕上一轮结果继续追问。" />
              </div>
            ) : null}
            {messages.map((item) => (
              <div key={`${item.role}-${item.id}`} className={`ops-robot-message ops-robot-message--${item.role}`}>
                <div className="ops-robot-message__bubble">
                  <div className="ops-robot-message__text">{item.payload?.text || item.messageText}</div>
                  {item.role === "assistant" ? (item.payload?.cards || []).map(renderCard) : null}
                </div>
              </div>
            ))}
            {loading ? <div className="quality-ops-robot__thinking"><LoadingOutlined spin /> 正在结合质量事实和会话历史分析...</div> : null}
          </div>

          <div className="ops-robot-panel__footer">
            <div className="ops-robot-suggestions">
              {suggestions.slice(0, 3).map((item) => (
                <button key={item} type="button" className="ops-robot-suggestions__chip" disabled={loading} onClick={() => void sendMessage(item)}>
                  <MessageOutlined /><span>{item}</span>
                </button>
              ))}
            </div>
            <div className="ops-robot-composer">
              <Input.TextArea
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="输入质量问题，或继续追问上一轮结果"
                autoSize={{ minRows: 2, maxRows: 4 }}
                onPressEnter={(event) => {
                  if (!event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(inputValue);
                  }
                }}
              />
              <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={() => void sendMessage(inputValue)}>发送</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
