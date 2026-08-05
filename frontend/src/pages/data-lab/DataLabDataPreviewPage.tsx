import { Button, Card, Input, Space, Table, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { exportSceneTableCsv, fetchSceneDetail, previewSceneTableData } from "../../services/dataLab";
import type { LabSceneFieldRecord, LabSceneTableRecord } from "../../types/api";

type PreviewData = {
  table: Record<string, unknown>;
  rows: Array<Record<string, unknown>>;
  total: number;
  page: number;
  pageSize: number;
};

function formatDateTime(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  const raw = String(value).trim();
  if (!raw) return "-";
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw) || /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(raw)) {
    return raw.replace("T", " ").replace(/\.\d+Z?$/, "");
  }
  return raw;
}

function looksLikeTimeField(field?: LabSceneFieldRecord) {
  const fieldType = String(field?.fieldType || "").toUpperCase();
  const semantic = String(field?.businessSemantic || "").toUpperCase();
  return fieldType.includes("DATE") || fieldType.includes("TIME") || semantic.includes("DATE") || semantic.includes("TIME");
}

function renderTableButtonLabel(table: LabSceneTableRecord) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
      <span>{String(table.logicalTableName)}</span>
      {table.tableComment ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>{`(${table.tableComment})`}</Typography.Text> : null}
    </span>
  );
}

export function DataLabDataPreviewPage({ embedded = false }: { embedded?: boolean }) {
  const { token } = useAuth();
  const { id } = useParams();
  const [tableName, setTableName] = useState("");
  const [tables, setTables] = useState<LabSceneTableRecord[]>([]);
  const [fields, setFields] = useState<LabSceneFieldRecord[]>([]);
  const [preview, setPreview] = useState<PreviewData | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    fetchSceneDetail(token, Number(id)).then((response) => {
      const sceneTables = response.data.sceneTables || [];
      const sceneFields = response.data.sceneFields || [];
      setTables(sceneTables);
      setFields(sceneFields);
      const firstTable = sceneTables[0]?.logicalTableName || "";
      setTableName(firstTable);
      if (firstTable) {
        previewSceneTableData(token, Number(id), firstTable).then((result) => setPreview(result.data));
      }
    });
  }, [token, id]);

  async function loadPreview(targetTableName = tableName) {
    if (!token || !id || !targetTableName) return;
    const result = await previewSceneTableData(token, Number(id), targetTableName);
    setPreview(result.data);
    setTableName(targetTableName);
  }

  function downloadCsv(fileName: string, content: string) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const activeTable = useMemo(
    () => tables.find((item) => item.logicalTableName === tableName || item.physicalTableName === tableName) || null,
    [tables, tableName]
  );

  const activeFields = useMemo(
    () => fields.filter((item) => item.tableName === tableName || item.tableName === activeTable?.logicalTableName),
    [fields, tableName, activeTable]
  );

  const fieldMap = useMemo(
    () =>
      new Map(
        activeFields.map((field) => [
          field.fieldName,
          field,
        ])
      ),
    [activeFields]
  );

  const columns = useMemo(
    () =>
      Object.keys(preview?.rows?.[0] || {}).map((key) => {
        const field = fieldMap.get(key);
        return {
          title: (
            <div style={{ lineHeight: 1.2 }}>
              <div>{key}</div>
              {field?.fieldComment ? (
                <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                  {field.fieldComment}
                </Typography.Text>
              ) : null}
            </div>
          ),
          dataIndex: key,
          key,
          width: looksLikeTimeField(field) ? 180 : undefined,
          render: (value: unknown) => (looksLikeTimeField(field) ? formatDateTime(value) : String(value ?? "-")),
        };
      }),
    [preview, fieldMap]
  );

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Card bordered={false}>
        <Space wrap>
          {tables.map((table) => (
            <Button
              key={String(table.id)}
              type={tableName === table.logicalTableName ? "primary" : "default"}
              onClick={() => loadPreview(String(table.logicalTableName))}
            >
              {renderTableButtonLabel(table)}
            </Button>
          ))}
          <Input placeholder="当前版本暂未实现服务端字段过滤，可按表切换" style={{ width: 320 }} disabled />
          {tableName ? (
            <Button
              onClick={async () => {
                const response = await exportSceneTableCsv(token!, Number(id), tableName);
                downloadCsv(response.data.fileName, response.data.content);
                message.success("CSV 已导出");
              }}
            >
              导出 CSV
            </Button>
          ) : null}
        </Space>
      </Card>
      <Card bordered={false}>
        {preview ? (
          <Table
            rowKey={(_, index) => String(index)}
            dataSource={preview.rows}
            columns={columns}
            scroll={{ x: 1600 }}
            pagination={{ pageSize: 20, size: "small" }}
          />
        ) : (
          <Typography.Text type="secondary">暂无数据</Typography.Text>
        )}
      </Card>
    </Space>
  );
}
