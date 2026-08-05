import { ArrowLeftOutlined, PlayCircleOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageToolbar } from "../../components/ui/PageToolbar";
import {
  fetchDataServiceApps,
  fetchDataServiceAuthorizations,
  fetchDataServices,
  invokeRuntimeDataService,
} from "../../services/dataServices";
import type {
  DataServiceAppRecord,
  DataServiceAuthorizationRecord,
  DataServiceRecord,
} from "../../types/api";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  createServiceUsageTask,
  loadServiceUsageTasks,
  saveServiceUsageTasks,
  type ServiceUsageTask,
} from "./serviceUsageTasks";

type EditorFormValues = Omit<ServiceUsageTask, "key" | "updatedAt">;

function buildParamsObject(paramsList?: Array<{ key?: string; value?: string }>) {
  return (paramsList || []).reduce<Record<string, unknown>>((acc, item) => {
    const key = String(item.key || "").trim();
    if (!key) return acc;
    acc[key] = item.value ?? "";
    return acc;
  }, {});
}

export function DataServiceUsageEditorPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ taskKey: string }>();
  const [form] = Form.useForm<EditorFormValues>();
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<DataServiceRecord[]>([]);
  const [apps, setApps] = useState<DataServiceAppRecord[]>([]);
  const [authorizations, setAuthorizations] = useState<DataServiceAuthorizationRecord[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: "success" | "error"; latencyMs: number; requestParams: Record<string, unknown>; payload: unknown } | null>(null);

  const taskKey = params.taskKey || "";

  useEffect(() => {
    const tasks = loadServiceUsageTasks();
    const task = tasks.find((item) => item.key === taskKey);
    if (task) {
      form.setFieldsValue({
        taskName: task.taskName,
        serviceId: task.serviceId,
        appId: task.appId,
        path: task.path,
        method: task.method,
        appToken: task.appToken,
        paramsList: task.paramsList?.length ? task.paramsList : [{ key: "", value: "" }],
        callsPerMinuteMin: task.callsPerMinuteMin,
        callsPerMinuteMax: task.callsPerMinuteMax,
      });
    } else {
      const nextTask = createServiceUsageTask();
      nextTask.key = taskKey || nextTask.key;
      form.setFieldsValue({
        taskName: nextTask.taskName,
        method: nextTask.method,
        path: nextTask.path,
        appToken: nextTask.appToken,
        paramsList: nextTask.paramsList,
        callsPerMinuteMin: nextTask.callsPerMinuteMin,
        callsPerMinuteMax: nextTask.callsPerMinuteMax,
      });
    }
  }, [form, taskKey]);

  useEffect(() => {
    async function loadOptions() {
      if (!token) return;
      setLoading(true);
      try {
        const [servicesResponse, appsResponse, authorizationsResponse] = await Promise.all([
          fetchDataServices(token),
          fetchDataServiceApps(token),
          fetchDataServiceAuthorizations(token),
        ]);
        setServices((servicesResponse.data || []).filter((item) => item.status === "published"));
        setApps(appsResponse.data || []);
        setAuthorizations(authorizationsResponse.data || []);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "加载任务编辑配置失败");
      } finally {
        setLoading(false);
      }
    }

    void loadOptions();
  }, [token]);

  const watchedAppId = Form.useWatch("appId", form);

  const appOptions = useMemo(() => apps.map((item) => ({
    label: `${item.appName}${item.departmentName ? ` / ${item.departmentName}` : ""}`,
    value: item.id,
  })), [apps]);

  const serviceOptions = useMemo(() => services.map((item) => ({
    label: `${item.serviceName} (${item.requestMethod} ${item.servicePath})`,
    value: item.id,
  })), [services]);

  async function handleSave() {
    const values = await form.validateFields();
    const tasks = loadServiceUsageTasks();
    const nextTask: ServiceUsageTask = {
      key: taskKey || `task-${Date.now()}`,
      taskName: values.taskName || "未命名任务",
      serviceId: values.serviceId,
      appId: values.appId,
      path: values.path,
      method: values.method,
      appToken: values.appToken,
      paramsList: values.paramsList?.length ? values.paramsList : [{ key: "", value: "" }],
      callsPerMinuteMin: Math.max(1, Number(values.callsPerMinuteMin || 1)),
      callsPerMinuteMax: Math.max(
        Math.max(1, Number(values.callsPerMinuteMin || 1)),
        Number(values.callsPerMinuteMax || values.callsPerMinuteMin || 1)
      ),
      updatedAt: new Date().toISOString(),
    };
    const exists = tasks.some((item) => item.key === nextTask.key);
    const nextTasks = exists
      ? tasks.map((item) => item.key === nextTask.key ? nextTask : item)
      : [nextTask, ...tasks];
    saveServiceUsageTasks(nextTasks);
    message.success("任务已保存");
    navigate("/dashboard/service-usage");
  }

  async function handleTestInvoke() {
    if (!token) return;
    const values = await form.validateFields();
    const requestParams = buildParamsObject(values.paramsList);
    const startedAt = Date.now();
    setTesting(true);
    try {
      const response = await invokeRuntimeDataService({
        path: values.path,
        method: values.method,
        appToken: values.appToken,
        params: requestParams,
      });
      const latencyMs = Date.now() - startedAt;
      setTestResult({
        status: "success",
        latencyMs,
        requestParams,
        payload: response,
      });
      message.success("测试调用成功");
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      const errorMessage = error instanceof Error ? error.message : "测试调用失败";
      setTestResult({
        status: "error",
        latencyMs,
        requestParams,
        payload: errorMessage,
      });
      message.error(errorMessage);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="app-page">
      <div className="app-page-body">
        <PageToolbar
          left={(
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/dashboard/service-usage")}>返回任务清单</Button>
              <Typography.Title level={4} style={{ margin: 0 }}>任务编辑</Typography.Title>
            </Space>
          )}
          right={(
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>重置</Button>
              <Button icon={<PlayCircleOutlined />} loading={testing} onClick={() => void handleTestInvoke()}>测试调用</Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={() => void handleSave()}>保存任务</Button>
            </Space>
          )}
        />

        <Card title="调用配置" loading={loading}>
          <Form form={form} layout="vertical" initialValues={{ method: "GET", callsPerMinuteMin: 1, callsPerMinuteMax: 1, paramsList: [{ key: "", value: "" }] }}>
            <Form.Item name="taskName" label="任务名称" rules={[{ required: true, message: "请输入任务名称" }]}>
              <Input placeholder="例如：婚姻登记查询频率验证" />
            </Form.Item>
            <Form.Item name="appId" label="调用应用">
              <Select
                allowClear
                options={appOptions}
                onChange={(value) => {
                  const app = apps.find((item) => item.id === value);
                  form.setFieldValue("appToken", app?.appToken || "");
                }}
              />
            </Form.Item>
            <Form.Item name="serviceId" label="已授权服务">
              <Select
                allowClear
                options={serviceOptions.filter((item) => {
                  const record = services.find((service) => service.id === item.value);
                  if (!record) return false;
                  if (!watchedAppId) return true;
                  return authorizations.some((auth) => auth.appId === watchedAppId && auth.serviceId === record.id && auth.status === "active");
                })}
                onChange={(value) => {
                  const service = services.find((item) => item.id === value);
                  if (service) {
                    form.setFieldsValue({
                      path: service.servicePath,
                      method: service.requestMethod,
                    });
                  }
                }}
              />
            </Form.Item>
            <Row gutter={16}>
              <Col xs={24} md={14}>
                <Form.Item name="path" label="接口地址" rules={[{ required: true, message: "请输入接口地址" }]}>
                  <Input placeholder="/demo/orders" />
                </Form.Item>
              </Col>
              <Col xs={24} md={10}>
                <Form.Item name="method" label="请求方式" rules={[{ required: true, message: "请选择请求方式" }]}>
                  <Select options={[{ value: "GET", label: "GET" }, { value: "POST", label: "POST" }]} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="appToken" label="授权信息 / Token">
              <Input.Password placeholder="Bearer Token 或应用 Token" />
            </Form.Item>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="callsPerMinuteMin" label="每分钟调用次数下限" rules={[{ required: true, message: "请输入下限" }]}>
                  <InputNumber min={1} max={120} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="callsPerMinuteMax"
                  label="每分钟调用次数上限"
                  rules={[
                    { required: true, message: "请输入上限" },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const min = Number(getFieldValue("callsPerMinuteMin") || 1);
                        const max = Number(value || 0);
                        if (max >= min) return Promise.resolve();
                        return Promise.reject(new Error("上限不能小于下限"));
                      },
                    }),
                  ]}
                >
                  <InputNumber min={1} max={120} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            </Row>

            <Divider style={{ margin: "12px 0" }}>接口参数</Divider>
            <Form.List name="paramsList">
              {(fields, { add, remove }) => (
                <Space direction="vertical" size={8} style={{ display: "flex" }}>
                  {fields.map((field) => (
                    <Row gutter={8} key={field.key}>
                      <Col span={10}>
                        <Form.Item {...field} name={[field.name, "key"]} rules={[{ required: true, message: "参数名必填" }]}>
                          <Input placeholder="参数名，如 id" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item {...field} name={[field.name, "value"]}>
                          <Input placeholder="参数值" />
                        </Form.Item>
                      </Col>
                      <Col span={2}>
                        <Button danger type="link" onClick={() => remove(field.name)}>删</Button>
                      </Col>
                    </Row>
                  ))}
                  <Button type="dashed" onClick={() => add({ key: "", value: "" })}>新增参数</Button>
                </Space>
              )}
            </Form.List>
          </Form>
        </Card>

        {testResult ? (
          <Card title="测试结果">
            <Space direction="vertical" size={12} style={{ display: "flex" }}>
              <Alert
                type={testResult.status === "success" ? "success" : "error"}
                showIcon
                message={testResult.status === "success" ? "调用成功" : "调用失败"}
                description={`耗时 ${testResult.latencyMs}ms`}
              />
              <div>
                <Typography.Text strong>请求参数</Typography.Text>
                <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", overflow: "auto" }}>
                  {JSON.stringify(testResult.requestParams, null, 2)}
                </pre>
              </div>
              <div>
                <Typography.Text strong>{testResult.status === "success" ? "响应结果" : "错误详情"}</Typography.Text>
                <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", overflow: "auto" }}>
                  {typeof testResult.payload === "string"
                    ? testResult.payload
                    : JSON.stringify(testResult.payload, null, 2)}
                </pre>
              </div>
            </Space>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
