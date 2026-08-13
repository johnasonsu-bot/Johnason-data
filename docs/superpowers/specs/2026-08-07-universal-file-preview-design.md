# 通用文件浏览器预览能力设计

## 1. 背景与目标

系统知识库当前的“预览”接口只返回解析片段或截断后的纯文本，前端统一用普通段落展示。因此，HTML 知识图谱和延误处置模拟无法交互，Markdown、JSON、SQL 没有结构化渲染，PDF、图片、音视频和 Office 文件也不能获得符合文件类型的预览体验。

本次建设一个平台级通用文件预览能力，并首先接入“系统管理 → 行业知识库 → 知识库详情”的文档列表。能力必须满足：

- 按文件类型选择合适的浏览器渲染器。
- 交互式 HTML 可运行，但与平台身份、Cookie 和父页面权限隔离。
- 文件内容必须经过现有登录鉴权，不能暴露服务端文件路径。
- 大文件采用流式响应或受控转换，避免塞入普通 JSON 响应。
- 不支持的类型或转换失败时安全降级为文件信息与下载入口。
- 公共组件和后端能力可以被资产、报告、数据实验室等其他模块复用。

## 2. 方案选择

采用“前端渲染器注册表 + 后端统一文件内容接口”的组合方案。

未采用的方案：

- 所有文件统一转换为 HTML：会损失代码、JSON、表格等结构化文件的交互和可读性。
- 外部在线 Office Viewer：需要公网访问并可能导致内部文档外传，不符合本地部署与数据安全要求。

## 3. 总体架构

### 3.1 后端职责

后端在知识库文档模块增加预览描述与受控内容输出：

1. 根据数据库记录和安全解析后的真实文件识别扩展名、MIME 类型、文件大小与预览类别。
2. 返回不含磁盘路径的预览描述对象。
3. 对可由浏览器直接展示的文件，以鉴权后的流式接口返回原始内容。
4. 对 Office 文件使用本机 LibreOffice 无头模式转换为缓存 PDF，再通过同一受控内容接口输出。
5. 对文本文件提供受大小限制、编码归一化后的文本内容。
6. 所有路径必须由文档数据库记录解析，不接受客户端传入文件路径。

建议接口：

- `GET /api/v1/system-knowledge-bases/documents/:documentId/preview`
  - 保留现有解析片段字段，新增 `viewer` 描述。
- `GET /api/v1/system-knowledge-bases/documents/:documentId/content`
  - 返回原始或转换后的预览内容流。
  - 查询参数仅允许受控值，例如 `variant=original|pdf|text`。

`viewer` 描述至少包含：

- `kind`：`html`、`markdown`、`code`、`json`、`table`、`pdf`、`image`、`audio`、`video`、`office`、`unsupported`。
- `mimeType`、`fileName`、`fileSize`。
- `contentUrl` 或前端可拼接的文档内容地址。
- `language`：SQL、JSON、YAML 等代码语言提示。
- `converted`、`fallbackReason`、`maxPreviewBytes`。

### 3.2 前端职责

新增公共组件 `UniversalFilePreview`，组件只依赖预览描述和带鉴权的内容加载函数，不直接依赖知识库页面。

组件内部通过渲染器注册表分派：

- `HtmlPreview`
- `MarkdownPreview`
- `CodePreview`
- `TablePreview`
- `PdfPreview`
- `ImagePreview`
- `MediaPreview`
- `UnsupportedPreview`

知识库页面将现有普通文本 Modal 替换为大尺寸预览 Drawer/Modal，并保留下载、文件信息、关闭和全屏操作。

## 4. 文件类型支持矩阵

| 文件类型 | 预览方式 | 降级方式 |
| --- | --- | --- |
| HTML/HTM | 隔离 iframe 交互预览 | 安全模式文本预览、下载 |
| Markdown/MD | 安全 Markdown、表格、代码块、Mermaid | 原文代码预览 |
| JSON | 格式化后的 Monaco 只读预览 | 原始文本 |
| SQL/XML/YAML/YML/TXT/LOG/代码文件 | Monaco 只读预览与语言识别 | 原始文本 |
| CSV | 浏览器表格预览 | 文本预览 |
| XLS/XLSX | 工作表结构化预览；必要时转 PDF | 下载 |
| DOC/DOCX/PPT/PPTX | LibreOffice 转 PDF | 已抽取文本或下载 |
| PDF | 浏览器原生 PDF 预览 | 下载 |
| PNG/JPG/JPEG/GIF/WebP/BMP/SVG | 图片预览、缩放 | 下载 |
| MP3/WAV/OGG/M4A | 浏览器音频控件 | 下载 |
| MP4/WebM/MOV | 浏览器视频控件 | 下载 |
| 其他二进制文件 | 文件信息卡片 | 下载 |

首个验收集合包含航空知识库中的 HTML、Markdown、JSON 和 SQL 文件。

## 5. HTML 安全模型

交互式 HTML 采用受信任文件的隔离执行模式：

- 前端通过鉴权请求读取 HTML 文本，不把访问令牌写入 iframe URL。
- 将内容注入 `srcDoc`，iframe 使用 `sandbox="allow-scripts"`。
- 不启用 `allow-same-origin`、`allow-forms`、`allow-popups` 或顶层导航能力。
- 在文档头部注入严格 CSP，默认禁止外部网络，仅允许自包含页面所需的内联脚本、内联样式和 `data:`/`blob:` 资源。
- 禁止 iframe 读取父窗口 DOM、localStorage、Cookie 和平台登录态。
- HTML 文件仍需通过平台鉴权读取；磁盘真实路径不会返回前端。

该方案允许航空知识图谱和延误处置模拟的拖拽、筛选、搜索、动画等本地交互，同时把运行环境限制在不透明来源的沙箱中。

## 6. Office 转换与缓存

本机已存在 LibreOffice `soffice`。Office 文件预览采用无头转换：

- 转换在固定的运行时缓存目录完成。
- 缓存键由文档 ID、文件更新时间和目标格式组成。
- 使用超时、输出大小和并发限制，防止转换进程长期占用资源。
- 转换失败不会阻断知识库详情页，返回明确的 `fallbackReason` 并展示下载入口。
- 缓存文件属于可再生运行时文件；删除知识库文档时不扩大本次删除行为，缓存清理另行采用安全的过期策略。

## 7. 错误处理与性能

- 文档不存在：返回 404。
- 文档无权访问：沿用项目范围和登录鉴权，返回 403/404。
- 文件记录存在但原始文件丢失：预览描述返回不可预览原因，解析片段仍可作为文本降级。
- 文本预览设置最大字节数并标明截断状态。
- 原始流支持浏览器 Range 请求，满足 PDF、音视频和大文件预览。
- 前端在切换或关闭预览时取消未完成请求并释放 Blob URL。
- 转换和渲染错误只影响当前文件预览，不影响知识库抽屉和其他文档操作。

## 8. 测试策略

遵循测试驱动开发，先编写失败测试，再实现最小功能：

### 8.1 后端测试

- 扩展名与 MIME 类型映射。
- 不同类型对应正确的 `viewer.kind`。
- 内容接口必须鉴权，且不能通过参数访问任意路径。
- 丢失文件、超限文件和未知类型的降级结果。
- HTML 内容输出及安全响应头。
- LibreOffice 转换成功、超时和失败降级。
- Range 请求的状态码与响应范围。

### 8.2 前端测试

- 渲染器注册表按 `kind` 选择组件。
- HTML iframe 的 sandbox 不包含 `allow-same-origin`。
- JSON/SQL/Markdown 渲染与异常降级。
- 关闭预览时释放资源。
- 知识库“预览”按钮打开公共预览器。

### 8.3 浏览器验收

在知识库界面依次验证：

- `aviation_delay_decision_simulation.html` 可交互且不能访问父页面。
- `aviation_ontology_knowledge_graph.html` 的搜索、布局切换和节点详情正常。
- 字段血缘 SQL 使用 SQL 语法展示。
- 字段血缘及知识库 JSON 格式化展示。
- Markdown 标题、表格、代码块正常渲染。
- 上传 PDF、图片和一个 Office 样例，验证原生或转换预览。
- 未支持文件出现可理解的提示和可用的下载按钮。

## 9. 兼容性与上线边界

- 保留现有 `/preview` 返回中的 `previewText`、`chunks` 等字段，避免破坏其他潜在调用方。
- 新能力先在系统知识库页面启用，公共组件和接口设计允许后续接入资产附件、治理报告和数据实验室产物。
- 本次不引入外部在线预览服务，不把 API Key、Token、密码或文件绝对路径写入代码和响应。

## 10. 完成标准

- 截图中的七个航空知识库文件均能按类型预览，而不是统一显示纯文本。
- 两个航空 HTML 产物可交互运行且通过沙箱安全检查。
- PDF、图片、Office、音视频与未知文件均具备明确的预览或降级行为。
- 后端和前端新增测试通过，现有相关测试与前端构建通过。
- 在本地 Data Platform 知识库页面完成真实浏览器验证。
