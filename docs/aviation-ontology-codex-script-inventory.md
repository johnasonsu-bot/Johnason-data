# 使用 Codex 构建航空本体项目的脚本清单

> 适用项目：`aviation_ontology_demo`
>
> 目标：从本地 Data Platform 环境、航空数据接入和 ODS 治理开始，构建“5 个实体 + 3 条关系 + 2 条规则”的语义层，并把数据标准、数据地图、逻辑/物理模型、知识库、字段级血缘和航空延误报表装载到平台。
>
> 安全要求：API Key、Token、数据库密码只通过环境变量或平台密钥字段注入，禁止写入脚本、JSON、SQL、Markdown 或 Git 历史。

## 1. 推荐执行顺序

| 阶段 | 执行入口 | 主要输入 | 主要输出 | 是否可重复执行 |
| --- | --- | --- | --- | --- |
| 1. 安装预览与 DataX 运行依赖 | `scripts/install-preview-dependencies.sh` / `.ps1` | 操作系统包管理器 | Java、Python、LibreOffice | 是 |
| 2. 校验企业数据库 DataX | `node scripts/verify-datax-enterprise-plugins.js` | 仓库内 DataX 插件 | Oracle/达梦 Reader、Writer 就绪报告 | 是 |
| 3. 启动 Data Platform | `scripts/start-dev.ps1` | `.env`、Docker | MySQL、后端 46121、前端 46120 | 是 |
| 4. 执行 ODS 治理 | `scripts/aviation_ontology_governance.sql` | 航空 ODS 数据库 | 主键/唯一键、审计字段、注释、质量规则、资源登记 | 是，幂等 |
| 5. 创建语义视图与血缘 | `scripts/aviation_ontology_field_lineage.sql` | 治理后的 ODS 表 | DWD 实体/关系/规则视图、字段级血缘登记 | 是，幂等 |
| 6. 装载平台资产 | `node backend/src/scripts/bootstrap-aviation-demo.js` | 知识库 JSON、血缘 JSON、ODS 元数据 | 数据标准、数据地图、逻辑/物理模型、报表资产 | 是，事务化 |
| 7. 验证本体契约 | `node --test scripts/aviation_ontology_assets.test.js backend/src/scripts/bootstrap-aviation-demo.test.js` | JSON、SQL、HTML 产物 | 5/3/2 契约、字段血缘、独立 HTML、平台资产测试结果 | 是 |
| 8. 全量回归 | `scripts/verify-package.ps1` | 完整仓库 | 后端测试、前端构建、源码包边界验证 | 是 |

## 2. 环境与运行脚本

### 2.1 `scripts/install-preview-dependencies.sh`

- macOS：通过 Homebrew 安装 OpenJDK 11 和 LibreOffice。
- Debian/Ubuntu：安装 Java、Python 3、LibreOffice Writer/Calc/Impress 和中文字体。
- 用途：同时满足 DataX Java 运行和 Office 文件转 PDF 预览。

```bash
bash scripts/install-preview-dependencies.sh
```

Windows：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-preview-dependencies.ps1
```

### 2.2 `scripts/install-datax-enterprise-plugins.sh`

- 从固定的 Alibaba DataX 提交构建 Oracle、达梦读写插件。
- 下载 JDBC 驱动后执行 SHA-256 校验。
- 仅在插件缺失或需要重新构建时运行；常规启动不需要重复构建。

```bash
bash scripts/install-datax-enterprise-plugins.sh
```

### 2.3 `scripts/verify-datax-enterprise-plugins.js`

- 检查 `plugin.json`、插件主 JAR、共享依赖和 JDBC JAR。
- 直接读取 ZIP Central Directory，确认 Oracle、达梦 Driver 与 DataX 插件入口类真实存在。

```bash
node scripts/verify-datax-enterprise-plugins.js
```

预期结果：

```text
Oracle DataX reader: ready
Oracle DataX writer: ready
DM DataX reader: ready
DM DataX writer: ready
```

### 2.4 `scripts/start-dev.ps1`

- 启动本源码版 MySQL 容器。
- 导入平台种子资产。
- 启动后端 `http://127.0.0.1:46121`。
- 启动前端 `http://127.0.0.1:46120`。
- 自动等待服务健康后再返回成功。

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1
```

## 3. 航空 ODS 与语义层脚本

### 3.1 `scripts/aviation_ontology_governance.sql`

作用：

- 为航班、航空器、机组、天气、跑道等物理表补齐主键或业务唯一键。
- 增加 `source_updated_at`、`ingested_at` 等增量和审计字段。
- 补齐表注释、字段注释和负责人语义。
- 登记 `meta_resource_registry` 资源。
- 建立航空质量规则和 CODA 延误代码字典。
- 兼容 METAR `VRB` 等不能直接转换为数值的源值。

使用运行时 DSN 执行，DSN 不进入 Git：

```bash
psql "$AVIATION_ODS_DSN" -v ON_ERROR_STOP=1 -f scripts/aviation_ontology_governance.sql
```

### 3.2 `scripts/aviation_ontology_field_lineage.sql`

作用：

- 建立 `meta_ontology_field_lineage` 字段级血缘登记表。
- 创建五个实体相关的 DWD 视图。
- 创建 `operatedBy`、`staffedBy`、`impacts` 三类关系的字段连接证据。
- 创建天气延误推理和机组值勤约束的规则血缘。

```bash
psql "$AVIATION_ODS_DSN" -v ON_ERROR_STOP=1 -f scripts/aviation_ontology_field_lineage.sql
```

### 3.3 语义资产源文件

| 文件 | 角色 |
| --- | --- |
| `scripts/aviation_ontology_semantic_layer.md` | 语义层总体设计、实体、关系、规则、质量约束和治理结果 |
| `scripts/aviation_ontology_knowledge_base.md` | 面向人员阅读的航空术语、规则、经验案例与处置动作 |
| `scripts/aviation_ontology_knowledge_base.json` | 平台装载和图谱生成使用的机器可读知识库 |
| `scripts/aviation_ontology_field_lineage.md` | 面向人员阅读的概念字段到物理字段血缘 |
| `scripts/aviation_ontology_field_lineage.json` | Bootstrap、逻辑模型、数据地图和图谱使用的机器可读血缘 |

这些文件是同一语义契约的不同表达，修改实体、关系或规则时必须同步更新，并运行资产测试。

## 4. 平台资产装载脚本

### 4.1 `backend/src/scripts/bootstrap-aviation-demo.js`

该脚本是 Codex 构建航空本体项目的核心装载入口，默认项目 ID 为 7，可用环境变量覆盖：

```bash
AVIATION_PROJECT_ID=7 node backend/src/scripts/bootstrap-aviation-demo.js
```

脚本读取：

- `scripts/aviation_ontology_knowledge_base.json`
- `scripts/aviation_ontology_field_lineage.json`
- 已配置航空 ODS 数据源的实时表结构

脚本在一个事务中创建或更新：

1. 航空数据标准及标准数据元；
2. 数据地图资源、字段、主键和字段级关系；
3. 航空本体逻辑模型与物理模型；
4. 航空延误分析数据集、图表和报表看板。

失败时事务回滚，不保留半成品。数据库凭据从进程环境和平台加密数据源读取，不在脚本中保存。

### 4.2 `scripts/import-seed-project-assets.js`

- 首次启动源码版平台时导入项目快照和知识库文件。
- 由 `scripts/start-dev.ps1` 自动调用，通常不需要单独执行。

```bash
node scripts/import-seed-project-assets.js
```

## 5. 数据接入运行代码

以下文件不是手工执行脚本，但属于航空 API 接入任务的运行链路：

| 文件 | 作用 |
| --- | --- |
| `backend/src/services/apiRowAdapters.js` | Aviationstack 航班与 AviationWeather METAR 响应转换为标准 ODS 行 |
| `backend/src/services/streamIngestionRunner.js` | API 分页、行适配、批量写入、增量游标和运行日志 |
| `backend/src/modules/ingestion-tasks/ingestion-task.service.js` | 接入任务配置、目标表模式、结构同步和运行调度 |
| `frontend/src/pages/data-ingestion-jobs/TaskConfigPage.tsx` | API/手工录入统一写入 `ods_flight_schedule` 的任务配置界面 |

真实 API Key 必须通过平台数据源密钥字段配置；清单和代码只记录参数名，不记录值。

## 6. 测试脚本

### 6.1 本体资产测试

```bash
node --test scripts/aviation_ontology_assets.test.js
```

验证：

- 5 个实体、3 条关系、2 条规则；
- 至少 10 个术语和 3 个经验案例；
- 至少 30 条字段映射；
- 知识图谱与延误模拟 HTML 为无 CDN 的独立文件。

### 6.2 平台装载模型测试

```bash
node --test backend/src/scripts/bootstrap-aviation-demo.test.js
```

验证：

- 航空标准数据元覆盖本体字段和业务唯一键；
- 逻辑模型包含五张概念表和三条字段级关系；
- 延误报表数据集包含可执行字段和指标。

### 6.3 接入与结构同步测试

```bash
node --test \
  backend/src/services/apiRowAdapters.test.js \
  backend/src/modules/ingestion-tasks/ingestion-task.service.test.js \
  backend/src/modules/data-sources/data-source.metadata.test.js
```

验证 Aviationstack 过滤与主键、METAR 类型安全、ODS 目标模式、视图依赖下的结构同步等问题。

### 6.4 完整源码包回归

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-package.ps1
```

## 7. 浏览器交付物

| 文件 | 在 Data Platform 中的用途 |
| --- | --- |
| `outputs/aviation_ontology_knowledge_graph.html` | 行业知识库中预览 Obsidian 风格分层动态知识图谱 |
| `outputs/aviation_delay_decision_simulation.html` | 行业知识库中预览航空延误处置模拟 |
| `outputs/019fd07c-f4e0-7731-9405-327145a7f6e3/航空Demo调试写入链路修复日志.xlsx` | 记录调试界面动态服务、写入表、报错与修复方案 |

HTML 由 Codex 的 `interactive-knowledge-graph` 工作流根据知识库 JSON 和字段血缘 JSON 生成，必须保持单文件、离线、无 CDN。当前仓库把 HTML 作为受测试的版本化交付物；若重新生成，必须再次运行 `scripts/aviation_ontology_assets.test.js` 并在知识库界面验收交互。

## 8. Codex 一次性执行模板

以下命令展示推荐流水线；其中数据库 DSN 和项目 ID 由执行环境注入：

```bash
set -e

node scripts/verify-datax-enterprise-plugins.js
psql "$AVIATION_ODS_DSN" -v ON_ERROR_STOP=1 -f scripts/aviation_ontology_governance.sql
psql "$AVIATION_ODS_DSN" -v ON_ERROR_STOP=1 -f scripts/aviation_ontology_field_lineage.sql
AVIATION_PROJECT_ID="${AVIATION_PROJECT_ID:-7}" node backend/src/scripts/bootstrap-aviation-demo.js
node --test scripts/aviation_ontology_assets.test.js backend/src/scripts/bootstrap-aviation-demo.test.js
```

执行完成后的功能入口：

- 行业知识库：`/dashboard/system-knowledge-bases/industry`
- 数据标准：`/dashboard/data-standards`
- 数据地图：`/dashboard/data-map`
- 逻辑模型：`/dashboard/data-modeling/logical-models`
- 物理模型：`/dashboard/data-modeling/physical-models`
- 报表平台：`/dashboard/reporting/workbench`
