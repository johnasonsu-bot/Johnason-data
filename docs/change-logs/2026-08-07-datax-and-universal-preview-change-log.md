# Oracle/达梦 DataX 与知识库通用预览修复清单

> 日期：2026-08-07
>
> 分支：`dev`
>
> 范围：先恢复 Oracle、达梦数据库 DataX 读写能力，再建设知识库浏览器通用文件预览。
>
> 说明：本文件是本次原始代码更新文件与修复问题的唯一汇总清单；未把工作区中用户已有、与本功能无关的改动计入本次交付。

## 1. 修复结论

| 编号 | 原始问题 | 根因 | 修复方案 | 是否修改源代码 | 验证状态 |
| --- | --- | --- | --- | --- | --- |
| DPX-01 | Oracle 数据源可配置，但 DataX 无法执行读取或写入 | `oraclereader`、`oraclewriter` 目录为空，缺少插件描述、插件主类、共享依赖及 JDBC 驱动 | 固定 Alibaba DataX 源码提交构建读写插件，内置 Oracle JDBC 21.21，增加插件安装与 ZIP 类校验脚本 | 是 | 通过 |
| DPX-02 | 达梦数据库显示驱动就绪，但 DataX 无法执行读取或写入 | `rdbmsreader`、`rdbmswriter` 目录为空，缺少插件及达梦 JDBC 驱动 | 构建通用 RDBMS 读写插件，内置达梦 JDBC 8.1.3.140，校验 Driver 类和插件主类 | 是 | 通过 |
| DPX-03 | 仅检查文件存在无法证明插件可执行 | 原校验只覆盖 Node 侧适配器与配置生成，没有验证 JAR/ZIP 中的真实类 | 新增独立校验器，解析 ZIP Central Directory，验证插件与 JDBC 入口类 | 是 | 通过 |
| PRV-01 | 知识库“预览”只能显示解析摘要，HTML、SQL、JSON 等无法按文件类型渲染 | 后端只返回 `previewText`，前端固定用纯文本弹窗 | 新增文件类型识别器、受鉴权内容流接口和公共 `UniversalFilePreview` 组件 | 是 | 通过 |
| PRV-02 | 航空延误模拟 HTML 和知识图谱无法在平台内交互执行 | HTML 被当作不支持的文本类型，且缺少隔离渲染容器 | HTML 使用无同源权限 iframe 沙箱；前后端同时注入 CSP，禁止网络连接、表单、插件与跨窗口行为 | 是 | 通过 |
| PRV-03 | Markdown、JSON、SQL、CSV/Excel、PDF、图片、音视频缺少统一预览 | 无公共渲染路由和内容获取协议 | Markdown 使用净化后的 HTML 与严格 Mermaid；JSON/代码使用只读 Monaco；CSV/Excel 使用表格；PDF/媒体使用 Blob URL；大文件支持单段 Range | 是 | 通过 |
| PRV-04 | Word、Excel、PowerPoint 无法浏览器预览 | 服务端没有 Office 转换器，部署代码未声明 LibreOffice | 增加 LibreOffice 查找、隔离用户配置、确定性缓存和 PDF 转换；补充 macOS、Debian、Windows 安装脚本与后端 Dockerfile | 是 | 通过 |
| PRV-05 | 预览接口可能向前端暴露服务器绝对文件路径 | 原预览结果直接返回数据库文档记录 | 返回前删除 `filePath`，内容只能通过鉴权接口按文档 ID 获取 | 是 | 通过 |
| PRV-06 | 首轮浏览器验收时 HTML/SQL 仍显示“暂不支持深度解析”摘要 | 旧 `readDocumentText` 白名单没有 HTML、SQL 及其他代码扩展 | 补齐 HTML、SQL、YAML、XML、JS/TS、CSS、Shell、Python、Java 等文本扩展并增加回归测试 | 是 | 通过 |
| PRV-07 | 预览加载时出现 Ant Design `Spin tip` 使用警告 | `Spin` 的提示文字未采用嵌套模式 | 将加载图标和提示文字改为独立布局 | 是 | 通过 |

## 2. 原始代码更新文件

### 2.1 Oracle 与达梦 DataX

| 文件或目录 | 变更类型 | 作用 |
| --- | --- | --- |
| `backend/datax/plugin/reader/oraclereader/` | 新增运行文件 | Oracle DataX Reader 插件、描述、模板、依赖和 JDBC 驱动 |
| `backend/datax/plugin/writer/oraclewriter/` | 新增运行文件 | Oracle DataX Writer 插件、描述、模板、依赖和 JDBC 驱动 |
| `backend/datax/plugin/reader/rdbmsreader/` | 新增运行文件 | 达梦 DataX Reader 使用的 RDBMS 插件、依赖和达梦 JDBC 驱动 |
| `backend/datax/plugin/writer/rdbmswriter/` | 新增运行文件 | 达梦 DataX Writer 使用的 RDBMS 插件、依赖和达梦 JDBC 驱动 |
| `backend/src/modules/data-sources/data-source.database-capabilities.test.js` | 修改测试 | 校验企业数据库 DataX 插件可执行类 |
| `scripts/install-datax-enterprise-plugins.sh` | 新增脚本 | 从固定 DataX 提交构建四个插件，并以 SHA-256 校验 JDBC 驱动 |
| `scripts/verify-datax-enterprise-plugins.js` | 新增脚本 | 检查插件描述、JAR 结构、插件入口类和 Driver 类 |

Oracle JDBC 文件 SHA-256：`feec08f9cdb427a87575a7093c1cae27f1c9c13a6b17900743b801ab8ec3696c`。

达梦 JDBC 文件 SHA-256：`9af4ff4d6ed15948507f528a18ab9b7196b3600d9169ad7998c19869031a3c6f`。

### 2.2 后端通用预览与 LibreOffice

| 文件 | 变更类型 | 作用 |
| --- | --- | --- |
| `.env.example` | 修改配置模板 | 增加可选 `LIBREOFFICE_BIN`，不写入任何密码、Token 或 API Key |
| `backend/Dockerfile` | 新增部署文件 | 安装 Java、Python、LibreOffice Writer/Calc/Impress 和中文字体 |
| `backend/package.json` | 修改脚本 | 增加预览依赖安装和企业 DataX 校验命令 |
| `backend/src/modules/system-knowledge-base/system-knowledge-base.preview.js` | 新增源代码 | 文件分类、预览描述、HTML CSP 注入、HTTP 单段 Range 解析 |
| `backend/src/modules/system-knowledge-base/system-knowledge-base.content.js` | 新增源代码 | 原文件、文本、PDF 三种内容变体与安全响应文件名 |
| `backend/src/modules/system-knowledge-base/libreoffice-preview.js` | 新增源代码 | LibreOffice 探测、隔离转换、缓存复用和超时控制 |
| `backend/src/modules/system-knowledge-base/system-knowledge-base.controller.js` | 修改源代码 | 流式内容响应、Range 206/416、CSP 与安全响应头 |
| `backend/src/modules/system-knowledge-base/system-knowledge-base.routes.js` | 修改源代码 | 增加受登录鉴权保护的文档内容接口 |
| `backend/src/modules/system-knowledge-base/system-knowledge-base.service.js` | 修改源代码 | 返回安全预览描述、解析文档内容、读取所有支持的文本/代码扩展 |
| `backend/src/modules/system-knowledge-base/*.preview.test.js` | 新增测试 | 文件类型、路径隐藏、CSP、Range 与 LibreOffice 单元测试 |
| `backend/src/modules/system-knowledge-base/system-knowledge-base.content.test.js` | 新增测试 | 内容变体、HTML 沙箱、Office 转换与 Unicode 文件名测试 |
| `backend/src/modules/system-knowledge-base/system-knowledge-base.text.test.js` | 新增测试 | HTML 与 SQL 真实源文本读取回归测试 |
| `scripts/install-preview-dependencies.sh` | 新增脚本 | macOS/Homebrew 与 Debian/apt 安装 Java、Python、LibreOffice |
| `scripts/install-preview-dependencies.ps1` | 新增脚本 | Windows/winget 安装 Temurin 11、Python 和 LibreOffice |
| `环境说明与启动指南.md` | 修改文档 | 记录 DataX 与 LibreOffice 的安装、校验和部署方式 |

### 2.3 前端公共预览

| 文件 | 变更类型 | 作用 |
| --- | --- | --- |
| `frontend/package.json`、`frontend/package-lock.json` | 修改依赖 | 增加 `marked` 和 `dompurify` |
| `frontend/src/components/file-preview/UniversalFilePreview.tsx` | 新增组件 | 公共 Drawer、全屏、下载、HTML/Markdown/代码/表格/PDF/媒体渲染 |
| `frontend/src/components/file-preview/filePreview.ts` | 新增源代码 | 渲染器路由、HTML CSP、JSON 格式化、带引号和换行的 CSV 解析 |
| `frontend/src/components/file-preview/filePreview.test.ts` | 新增测试 | 渲染路由、CSP、JSON、CSV 回归测试 |
| `frontend/src/components/file-preview/index.ts` | 新增出口 | 对其他业务页面暴露公共预览组件 |
| `frontend/src/pages/system/SystemKnowledgeBasePage.tsx` | 修改源代码 | 知识库文件列表首次接入公共预览组件 |
| `frontend/src/services/systemKnowledgeBases.ts` | 修改源代码 | 增加带登录令牌与项目上下文的 Blob 内容获取 |
| `frontend/src/types/api.ts` | 修改类型 | 增加安全预览描述类型，服务器绝对路径改为非必需字段 |
| `frontend/src/styles/index.css` | 修改样式 | 预览容器、iframe、媒体、Markdown 和表格样式 |

### 2.4 设计与实施记录

| 文件 | 作用 |
| --- | --- |
| `docs/superpowers/specs/2026-08-07-universal-file-preview-design.md` | 安全边界、文件矩阵与接口设计 |
| `docs/superpowers/plans/2026-08-07-universal-file-preview.md` | 测试优先实施计划与 DataX 前置任务 |

## 3. 对外接口与运行依赖

### 3.1 新增接口

```text
GET /api/v1/system-knowledge-bases/documents/:documentId/content?variant=original|text|pdf
```

- 必须通过平台登录鉴权，并保留项目上下文校验。
- `original`：流式返回原文件。
- `text`：返回文本、代码、Markdown、HTML 或从 Excel 抽取的 CSV 文本。
- `pdf`：返回原 PDF，或调用 LibreOffice 将 Office 文件转换为 PDF。
- PDF、图片、音视频等二进制内容支持单段 `Range` 请求。
- HTML 响应附加 CSP，前端 iframe 不授予 `allow-same-origin`、弹窗、表单、下载和顶层导航权限。

### 3.2 运行依赖

| 依赖 | 用途 | 源码中的安装位置 |
| --- | --- | --- |
| JDK 8/11 | DataX 插件运行 | `scripts/install-preview-dependencies.*`、`backend/Dockerfile` |
| Python 3 | DataX 启动器 | `scripts/install-preview-dependencies.*`、`backend/Dockerfile` |
| LibreOffice Writer/Calc/Impress | Office 转 PDF | `scripts/install-preview-dependencies.*`、`backend/Dockerfile` |
| 中文字体 | Office/PDF 中文渲染 | `backend/Dockerfile` 的 `fonts-noto-cjk` |

## 4. 测试与验收记录

| 验证项 | 命令或方式 | 结果 |
| --- | --- | --- |
| Oracle/达梦插件结构与类 | `node scripts/verify-datax-enterprise-plugins.js` | Oracle Reader/Writer、DM Reader/Writer 全部 ready |
| DataX 模板生成 | `python3 backend/datax/bin/datax.py -r oraclereader -w streamwriter` 及达梦 RDBMS 模板 | 成功 |
| 后端预览专项测试 | `node --test src/modules/system-knowledge-base/*.test.js` 对应 13 个专项用例 | 13 通过，0 失败 |
| 后端既有回归 | `npm test` | 32 通过，0 失败，4 个可选真实数据库集成用例跳过 |
| 前端预览测试 | `npx vitest run src/components/file-preview/filePreview.test.ts` | 4 通过，0 失败 |
| 前端生产构建 | `npm run build` | 成功；仅存在项目原有的大分块提示 |
| LibreOffice 真实 DOCX 转 PDF | `购买与授权协议.docx` | 成功生成 286,789 bytes PDF |
| LibreOffice 真实 XLSX 转 PDF | `航空Demo调试写入链路修复日志.xlsx` | 成功生成 349,441 bytes PDF |
| 航空延误 HTML | 知识库界面点击预览并执行决策 | 成功渲染；脚本在沙箱内执行，输出“机组合规阻断”和动态服务 |
| 航空分层知识图谱 HTML | 知识库界面点击预览 | 成功渲染标题与布局控制按钮 |
| 航空知识库 Markdown | 知识库界面点击预览 | 标题、表格、代码和案例正常渲染 |
| 字段级血缘 SQL | 知识库界面点击预览 | Monaco 只读编辑器显示真实 SQL 源码 |
| 字段级血缘 JSON | 知识库界面点击预览 | Monaco 格式化显示真实 JSON 内容 |

## 5. Git 交付记录

| 提交 | 内容 |
| --- | --- |
| `4e48b47` | 恢复 Oracle 与达梦 DataX 插件、驱动和校验脚本 |
| `ed4840a` | 增加安全知识库内容接口、LibreOffice 转换及部署依赖 |
| `015a8b7` | 增加浏览器公共文件预览组件并接入知识库 |
| `ee3ac35` | 修复 HTML/SQL 返回摘要而非源文件的问题 |

## 6. 保留项与边界

- 未提交或覆盖工作区中本次任务开始前已经存在的航空接入、报表、数据库迁移等其他修改。
- 未把任何 API Key、Token、数据库密码写入源代码、安装脚本或配置模板。
- Oracle/达梦的四个“真实数据库连通”集成测试需要用户提供可访问实例和运行时凭据，因此本次只验证驱动加载、DataX 插件类、作业配置与模板生成；测试框架保留为可选用例。
- `npm audit` 当前报告的依赖风险属于项目依赖树的整体状态；本次没有执行可能引入破坏性升级的 `npm audit fix --force`。
