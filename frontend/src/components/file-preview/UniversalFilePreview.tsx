import { DownloadOutlined, FullscreenExitOutlined, FullscreenOutlined } from "@ant-design/icons";
import Editor from "@monaco-editor/react";
import { Alert, Button, Descriptions, Drawer, Empty, Space, Spin, Table, Tag, Typography } from "antd";
import DOMPurify from "dompurify";
import { marked } from "marked";
import mermaid from "mermaid";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchSystemKnowledgeDocumentContent } from "../../services/systemKnowledgeBases";
import type { SystemKnowledgeDocumentPreview } from "../../types/api";
import { buildSandboxedHtml, formatJsonContent, parseCsvContent, resolvePreviewRenderer } from "./filePreview";

export interface UniversalFilePreviewProps {
  open: boolean;
  preview: SystemKnowledgeDocumentPreview | null;
  token: string;
  onClose: () => void;
  onDownload?: () => void;
}

function MarkdownDocument({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => {
    const rendered = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(rendered, { USE_PROFILES: { html: true } });
  }, [content]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default" });
    const blocks = Array.from(container.querySelectorAll("pre code.language-mermaid"));
    void Promise.all(blocks.map(async (block, index) => {
      const source = block.textContent || "";
      const parent = block.parentElement;
      if (!source || !parent) return;
      try {
        const result = await mermaid.render(`knowledge-preview-mermaid-${Date.now()}-${index}`, source);
        if (!cancelled) parent.outerHTML = DOMPurify.sanitize(result.svg, { USE_PROFILES: { svg: true, svgFilters: true } });
      } catch {
        parent.setAttribute("data-mermaid-error", "true");
      }
    }));
    return () => { cancelled = true; };
  }, [html]);

  return <div ref={containerRef} className="universal-file-preview__markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function UniversalFilePreview({ open, preview, token, onClose, onDownload }: UniversalFilePreviewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [textContent, setTextContent] = useState("");
  const [blobUrl, setBlobUrl] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const viewer = preview?.viewer;
  const renderer = resolvePreviewRenderer(viewer);

  useEffect(() => {
    if (!open || !preview || !viewer) {
      setTextContent("");
      setError("");
      return;
    }
    let active = true;
    let createdUrl = "";
    setLoading(true);
    setError("");
    setTextContent("");
    setBlobUrl("");
    void fetchSystemKnowledgeDocumentContent(token, preview.document.id, viewer.preferredVariant)
      .then(async (blob) => {
        if (!active) return;
        if (["html", "markdown", "code", "json", "table"].includes(renderer)) {
          setTextContent(await blob.text());
        } else {
          createdUrl = URL.createObjectURL(blob);
          setBlobUrl(createdUrl);
        }
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "文件预览加载失败");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [open, preview?.document.id, renderer, token, viewer?.preferredVariant]);

  const tableData = useMemo(() => renderer === "table" ? parseCsvContent(textContent) : { columns: [], rows: [] }, [renderer, textContent]);

  function renderContent() {
    if (loading) return <div className="universal-file-preview__state"><Spin size="large" tip="正在加载文件预览" /></div>;
    if (error) return <Alert type="error" showIcon message="文件预览失败" description={error} action={onDownload ? <Button onClick={onDownload}>下载原文件</Button> : undefined} />;
    if (!viewer) return <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>{preview?.previewText || "暂无可预览内容"}</Typography.Paragraph>;
    if (renderer === "html") return <iframe className="universal-file-preview__frame" sandbox="allow-scripts" srcDoc={buildSandboxedHtml(textContent)} title={viewer.fileName} />;
    if (renderer === "markdown") return <MarkdownDocument content={textContent} />;
    if (renderer === "json" || renderer === "code") return <Editor height="68vh" language={renderer === "json" ? "json" : viewer.language || "plaintext"} value={renderer === "json" ? formatJsonContent(textContent) : textContent} options={{ readOnly: true, minimap: { enabled: false }, wordWrap: "on", automaticLayout: true }} />;
    if (renderer === "table") return <Table<Record<string, string>> size="small" rowKey={(_, index) => String(index)} pagination={{ pageSize: 50, showSizeChanger: false }} scroll={{ x: "max-content", y: "62vh" }} dataSource={tableData.rows} columns={tableData.columns.map((column) => ({ title: column, dataIndex: column, key: column, ellipsis: true }))} />;
    if (renderer === "pdf" && blobUrl) return <iframe className="universal-file-preview__frame" src={blobUrl} title={viewer.fileName} />;
    if (renderer === "image" && blobUrl) return <div className="universal-file-preview__media"><img src={blobUrl} alt={viewer.fileName} /></div>;
    if (renderer === "audio" && blobUrl) return <div className="universal-file-preview__media"><audio controls src={blobUrl}>当前浏览器不支持音频预览</audio></div>;
    if (renderer === "video" && blobUrl) return <div className="universal-file-preview__media"><video controls src={blobUrl}>当前浏览器不支持视频预览</video></div>;
    return <Empty description={viewer.fallbackReason || "当前文件类型暂不支持浏览器渲染"}>{onDownload ? <Button type="primary" icon={<DownloadOutlined />} onClick={onDownload}>下载原文件</Button> : null}</Empty>;
  }

  return (
    <Drawer
      open={open}
      width={fullscreen ? "100vw" : "min(1180px, 92vw)"}
      title={preview?.document.fileName || "文件预览"}
      onClose={onClose}
      destroyOnHidden
      extra={<Space>
        {viewer ? <Tag>{viewer.kind.toUpperCase()}</Tag> : null}
        <Button icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} onClick={() => setFullscreen((value) => !value)}>{fullscreen ? "退出全屏" : "全屏"}</Button>
        {onDownload ? <Button icon={<DownloadOutlined />} onClick={onDownload}>下载</Button> : null}
      </Space>}
    >
      {preview && viewer ? <Descriptions size="small" column={4} className="universal-file-preview__meta">
        <Descriptions.Item label="文件类型">{viewer.mimeType}</Descriptions.Item>
        <Descriptions.Item label="文件大小">{viewer.fileSize.toLocaleString()} bytes</Descriptions.Item>
        <Descriptions.Item label="解析状态">{preview.document.parseStatus}</Descriptions.Item>
        <Descriptions.Item label="预览模式">{viewer.converted ? "转换预览" : viewer.preferredVariant}</Descriptions.Item>
      </Descriptions> : null}
      <div className="universal-file-preview__body">{renderContent()}</div>
    </Drawer>
  );
}
