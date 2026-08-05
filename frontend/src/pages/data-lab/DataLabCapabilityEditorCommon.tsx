import { Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Typography } from "antd";
import type { FormInstance, TableColumnsType } from "antd";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

export type AnyRecord = Record<string, any>;

export type EditorFieldSpec = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "select" | "tags" | "switch";
  required?: boolean;
  placeholder?: string;
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: string }>;
  initialValue?: unknown;
};

export const 通用状态选项 = [
  { label: "有效", value: "active" },
  { label: "停用", value: "inactive" },
];

export function useStructuredField<T>(form: FormInstance, name: string, fallback: T): [T, (next: T) => void] {
  const watched = Form.useWatch(name, form);
  const value = (watched === undefined ? fallback : watched) as T;
  return [value, (next: T) => form.setFieldValue(name, next)];
}

export function 标签输入(props: { value?: string[]; onChange?: (next: string[]) => void; placeholder?: string }) {
  return (
    <Select
      mode="tags"
      value={props.value || []}
      onChange={(next) => props.onChange?.(next.map(String))}
      placeholder={props.placeholder}
      tokenSeparators={[",", "，", ";", "；"]}
      style={{ width: "100%" }}
    />
  );
}

export function 标签列表(props: { values?: Array<string | number | null | undefined> }) {
  const items = (props.values || []).map((item) => String(item || "").trim()).filter(Boolean);
  if (items.length === 0) {
    return <Typography.Text type="secondary">未配置</Typography.Text>;
  }
  return (
    <Space wrap>
      {items.map((item) => (
        <Tag key={item}>{item}</Tag>
      ))}
    </Space>
  );
}

export function 片段标题(props: { title: string; description: string }) {
  return (
    <Space direction="vertical" size={2} style={{ display: "flex" }}>
      <Typography.Text strong>{props.title}</Typography.Text>
      <Typography.Text type="secondary">{props.description}</Typography.Text>
    </Space>
  );
}

export function parse权重项(values: string[]) {
  return values.reduce<Record<string, number>>((result, item) => {
    const [rawKey, rawValue] = String(item || "").split(/[:：=]/);
    const key = String(rawKey || "").trim();
    const value = Number(rawValue || 0);
    if (key) {
      result[key] = Number.isFinite(value) && value > 0 ? value : 1;
    }
    return result;
  }, {});
}

export function format权重项(value: unknown) {
  const weights = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.entries(weights).map(([key, weight]) => `${key}:${Number(weight || 0)}`);
}

export function parse布尔值(value: unknown) {
  return value === true || value === "true";
}

export function 表格渲染(value: unknown) {
  if (Array.isArray(value)) {
    return <标签列表 values={value as Array<string | number>} />;
  }
  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }
  return String(value ?? "-");
}

function 渲染输入控件(field: EditorFieldSpec) {
  switch (field.type) {
    case "textarea":
      return <Input.TextArea rows={field.rows || 4} placeholder={field.placeholder} />;
    case "number":
      return <InputNumber style={{ width: "100%" }} min={field.min} max={field.max} step={field.step} placeholder={field.placeholder} />;
    case "select":
      return <Select options={field.options || []} placeholder={field.placeholder} />;
    case "tags":
      return <标签输入 placeholder={field.placeholder} />;
    case "switch":
      return <Switch />;
    case "text":
    default:
      return <Input placeholder={field.placeholder} />;
  }
}

function 默认值(fields: EditorFieldSpec[]) {
  return fields.reduce<AnyRecord>((result, field) => {
    if (field.initialValue !== undefined) {
      result[field.name] = field.initialValue;
      return result;
    }
    if (field.type === "tags") {
      result[field.name] = [];
    } else if (field.type === "switch") {
      result[field.name] = false;
    } else {
      result[field.name] = undefined;
    }
    return result;
  }, {});
}

type 可编辑列表表格Props = {
  modalTitle: string;
  addText: string;
  dataSource: AnyRecord[];
  onChange: (next: AnyRecord[]) => void;
  columns: TableColumnsType<AnyRecord>;
  fields: EditorFieldSpec[];
  normalize?: (values: AnyRecord) => AnyRecord;
  toFormValues?: (record?: AnyRecord) => AnyRecord;
};

export function 可编辑列表表格(props: 可编辑列表表格Props) {
  const [open, setOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editorForm] = Form.useForm();
  const initialValues = useMemo(() => 默认值(props.fields), [props.fields]);

  function 打开编辑(record?: AnyRecord, index?: number) {
    setEditingIndex(index ?? null);
    editorForm.resetFields();
    editorForm.setFieldsValue(props.toFormValues ? props.toFormValues(record) : { ...initialValues, ...(record || {}) });
    setOpen(true);
  }

  async function 保存记录() {
    const values = await editorForm.validateFields();
    const nextRecord = props.normalize ? props.normalize(values) : values;
    const nextData = editingIndex === null
      ? [...props.dataSource, nextRecord]
      : props.dataSource.map((item, index) => (index === editingIndex ? nextRecord : item));
    props.onChange(nextData);
    setOpen(false);
  }

  const tableColumns: TableColumnsType<AnyRecord> = [
    ...props.columns,
    {
      title: "操作",
      width: 160,
      render: (_value, record, index) => (
        <Space>
          <Button type="link" onClick={() => 打开编辑(record, index)}>编辑</Button>
          <Button type="link" danger onClick={() => props.onChange(props.dataSource.filter((_, current) => current !== index))}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={12} style={{ display: "flex" }}>
      <Space style={{ width: "100%", justifyContent: "flex-end" }}>
        <Button type="primary" onClick={() => 打开编辑()}>{props.addText}</Button>
      </Space>
      <Table
        rowKey={(_record, index) => String(index)}
        dataSource={props.dataSource}
        columns={tableColumns}
        pagination={false}
        locale={{ emptyText: "暂无数据" }}
      />
      <Modal
        open={open}
        title={props.modalTitle}
        onCancel={() => setOpen(false)}
        onOk={() => void 保存记录()}
        okText="确定"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={editorForm} layout="vertical" colon={false}>
          {props.fields.map((field) => (
            <Form.Item
              key={field.name}
              name={field.name}
              label={field.label}
              rules={field.required ? [{ required: true, message: `请填写${field.label}` }] : undefined}
              valuePropName={field.type === "switch" ? "checked" : "value"}
            >
              {渲染输入控件(field)}
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </Space>
  );
}
