# Data Platform 全平台 CLI 化架构设计

> 设计版本：1.2 · 覆盖清单基线：`dev@d2eeaca4c3fb562b9f064a6229178365998e68e4` · 清单生成时间：2026-08-12T02:19:27.335Z

## 1. 结论

Data Platform 将新增可通过 npm 全局安装的 `data-platform` CLI。CLI 不启动或调用 Express HTTP 服务，而是在独立 Node.js 进程中复用与 Web 相同的应用服务、权限策略、项目上下文和数据访问层，直接连接 MySQL、DataX、Kafka 与 JDBC 运行时。

架构采用“同步命令确定性受理、异步事件驱动归集”的模式：同步命令在一个本地 ACID 事务内完成业务校验、权威数据写入、审计事实和事务 Outbox 追加；daemon 将 Outbox 事件发布至 Kafka，消费者通过 Inbox 去重形成对账、预警、报表与 Agent 上下文投影。跨模块长任务使用 MySQL 持久化状态机和 daemon worker，不引入 Temporal。

本设计以用户提供的 Data Platform 功能入口和 API 清单为覆盖基线，明确纳入 84 个前端访问入口、23 个挂载业务模块、590 条模块路由和 6 条应用级直接接口，共 596 条 API。现有 Web API 路由和行为保持兼容；CLI 不成为绕过用户权限、只读限制或项目隔离的后门。

## 2. 目标与非目标

### 2.1 目标

- 以 `npm install -g @johnason/data-platform-cli` 安装，主命令为 `data-platform`。
- 覆盖平台全部业务域，并为每条现有 Express route 建立 CLI 能力映射或书面说明其不适用原因。
- 支持一次性子命令和默认 REPL，两者使用同一个命令注册表。
- 支持 human、JSON、NDJSON 与显式文件输出，满足人员、脚本和 Agent 使用。
- 严格执行当前有效的平台登录会话、用户状态、模块权限、只读限制、项目成员关系和项目隔离规则。
- 使用系统钥匙串保存数据库密码与短期平台会话；平台用户密码不保存。
- 以事务 Outbox、Kafka、Inbox、任务状态机、重试、死信、补偿和证据链支撑可靠异步处理。
- 提供无 HTTP daemon，承载 scheduler、worker、Kafka consumer 和必要的数据服务 runtime。
- 保持 Web API 行为兼容，并使 Web 与 CLI 逐步共享相同应用服务。
- 以机器可校验的追踪矩阵证明 `596/596` API 和 `84/84` 前端入口均已分配 CLI 能力面；任何新增、删除或修改的入口都必须先更新矩阵。

### 2.2 非目标

- 不通过 HTTP 调用本机或远端 Data Platform 后端。
- 不让 CLI 直接绕过 application service 操作 repository。
- 不引入 Temporal 或其他外部工作流引擎。
- 不在首期补齐许可证或激活实现。现有 `activation` 与 `license-feature` 为空实现，CLI 保持相同行为，但预留共享 policy 扩展点。
- 不提供隐式管理员模式或权限绕过参数。
- 不把密码、Token、模型密钥或其他敏感信息写入普通配置文件、日志或命令输出。

### 2.3 覆盖清单来源与版本边界

本设计使用以下三份资产，而不是仅依据仓库目录或示例路由推断功能：

| 资产 | 用途 | SHA-256 |
|---|---|---|
| `api-inventory.json` | 596 条 API、23 个模块、84 个前端入口的机器清单 | `6cd896d1e38fb54ebd8317842eb618c4a28ede4eecf5e09f5bfb16374d696d0f` |
| `PROJECT_OPERATION_MANUAL.md` | 模块目标、操作步骤、输入输出、完整接口目录和运行边界 | `619cf9c139ebd49788acd8a1a7440d5d8574cb9034b4bb7e13de1a14ca8db350` |
| `project-operation-knowledge-graph.html` | 人员、页面、模块、API、数据、基础设施和治理规则之间的关系 | `1fa8acde4615bc6bed8af23ad277fde1089643781bbb1414dd45d5302c03468f` |

清单扫描基线为 `dev@d2eeaca4c3fb562b9f064a6229178365998e68e4`。CLI 实施前必须将该提交与实际实施分支进行 inventory diff：新增接口进入范围，删除接口保留迁移说明，签名变化更新输入输出合同。不能用较旧分支的测试通过来替代清单对齐。

机器追踪文件为 [`data-platform-cli-coverage-baseline.json`](./data-platform-cli-coverage-baseline.json)，生成器为 `scripts/generate-cli-coverage-baseline.js`。追踪文件中每条 API 都包含建议 CLI 命令、action、交互类型、输入输出方式、同步/异步模式、认证、项目范围、feature guard、校验 schema、确认要求和源码位置；每个前端入口都包含对应 CLI capability surface。

### 2.4 API 全量覆盖矩阵

23 个业务模块的路由覆盖如下，模块路由合计 590 条：

| API 模块 | 路由数 | CLI 能力面 |
|---|---:|---|
| 认证与会话 `auth` | 4 | `auth` |
| 项目空间 `projects` | 17 | `project` |
| 平台总览 `platform` | 1 | `platform` |
| 资产检索 `asset-search` | 8 | `asset-search` |
| 数据地图 `data-map` | 41 | `data-map` |
| 数据标准 `data-standards` | 31 | `standard` |
| 数据源接入 `data-sources` | 9 | `datasource` |
| 数据调研 `data-source-research` | 18 | `source-research` |
| 建模数据源 `data-modeling-sources` | 9 | `data-lab source` |
| 接入任务 `ingestion-tasks` | 14 | `ingestion` |
| 文件导入 `file-imports` | 11 | `file-import` |
| 模型提供商 `model-providers` | 5 | `model-provider` |
| 接入 AI 配置 `ingestion-ai-configs` | 2 | `ingestion ai-config` |
| 开发 AI 配置 `dev-ai-configs` | 2 | `development ai-config` |
| 报表 AI 配置 `reporting-ai-configs` | 2 | `reporting ai-config` |
| 系统管理 `system-management` | 27 | `system` |
| 知识库 `system-knowledge-bases` | 12 | `knowledge-base` |
| 数据开发 `data-development` | 82 | `development` |
| 数据建模实验室 `data-modeling` | 135 | `data-lab` |
| 质量管控 `quality-control` | 87 | `quality` |
| 数据服务 `data-services` | 30 | `service` |
| 数据服务运行时 `service-runtime` | 2 | `service invoke` |
| 报表平台 `reporting` | 41 | `reporting` |

清单还包含 6 条不在上述模块 route 文件中的应用级直接接口，必须显式映射，禁止遗漏：

| 直接接口 | CLI 映射 |
|---|---|
| `GET /api/health` | `system doctor health` |
| `GET /api/v1/platform/database-capabilities` | `system doctor database-capabilities` |
| `GET /api/v1/jobs/:id` | `job show <id>` |
| `POST /api/auth/login` | `auth login` 的兼容入口，不重复实现业务逻辑 |
| `GET /api/auth/profile` | `auth profile` 的兼容入口，不重复实现业务逻辑 |
| `GET /api/v1/reporting/runtime/dashboards/:id` | `reporting runtime dashboard show <id>` |

596 条 API 按传输形态分为 230 条 JSON 读取、339 条 JSON 写入、12 条 multipart 上传、13 条下载和 2 条流式接口。CLI 对每种形态采用统一适配：

| API 交互 | 数量 | CLI 输入输出合同 |
|---|---:|---|
| `json-read` | 230 | flags/query → human table/detail 或 JSON envelope |
| `json-write` | 339 | flags 或 `--file` JSON/YAML → JSON envelope；写操作纳入幂等与审计 |
| `multipart` | 12 | `--file`/`--files` + flags；保留文件名、类型、大小与摘要证据 |
| `download` | 13 | 必须指定 `--output`；校验文件存在、大小、摘要和格式 |
| `stream` | 2 | human stream 或 NDJSON；日志写 stderr，取消信号可安全中止 |

### 2.5 前端功能入口全量覆盖

84 个前端入口按 CLI 能力域归集如下。追踪矩阵仍保留每一条具体路径，不能仅凭本表的汇总数声明完成：

| 功能入口域 | 入口数 | CLI 能力面 |
|---|---:|---|
| 资产检索 | 3 | `asset-search` |
| 数据开发与处理 | 13 | `development`、`development processing`、`development scheduling` |
| 数据接入、文件与调研 | 6 | `datasource`、`source-research`、`ingestion`、`file-import` |
| 数据地图 | 6 | `data-map` |
| 数据建模 | 10 | `data-lab` |
| 数据标准 | 8 | `standard` |
| 平台总览 | 1 | `platform` |
| 质量管控 | 10 | `quality` |
| 报表平台 | 8 | `reporting` |
| 数据服务 | 8 | `service` 及其 datasource/app/authorization/usage/audit/ops 子组 |
| 系统管理 | 11 | `system`、`project`、`model-provider`、`knowledge-base` |

对每个页面入口，CLI 覆盖对象是页面上用户可触发的业务动作和可读取的业务状态，而不是页面布局、CSS、拖拽手势等表现层细节。一个页面只有在以下条件同时满足时才能标记 `verified`：

1. 页面调用的所有 API 已关联至少一个已实现 CLI capability；
2. 纯前端但具有业务含义的操作已有 CLI 等价输入，例如图编辑器使用 `--file` 接收图模型；
3. 页面产生的下载、上传、流式、预览和长任务均有对应 CLI I/O 合同；
4. 页面权限、项目隔离和只读限制有 Web/CLI 契约测试；
5. 无 CLI 意义的纯表现功能必须逐项标记 `notApplicable` 并写明理由，不能整页豁免。

### 2.6 覆盖状态与硬门禁

追踪矩阵使用四种状态：

- `designed`：已分配 CLI 能力面和 I/O 策略，但不声称已经实现。
- `implemented`：命令注册表、application service 和 adapter 均存在。
- `verified`：Web/CLI 契约测试与 CLI subprocess 测试通过。
- `notApplicable`：仅允许用于没有业务语义的表现层能力，必须有书面理由和审查记录。

CI 必须执行覆盖校验并满足：

```text
API inventory total       = 596
API mapped                = 596
API unmapped              = 0
Frontend entry total      = 84
Frontend entry mapped     = 84
Frontend entry unmapped   = 0
Duplicate API key         = 0
Unknown CLI group         = 0
Stale source fingerprint  = 0
```

正式发布还要求所有条目从 `designed` 收敛为 `verified` 或经审查的 `notApplicable`。只做到命令名称映射不构成完成。

## 3. 总体架构

```mermaid
flowchart LR
    E["业务人员 / Agent / 外部系统"] --> C["CLI / Web BFF<br/>身份、项目、标准、命令受理"]
    C --> A["应用能力层<br/>全平台业务模块、规则校验、本地 ACID"]
    A --> F["事实层<br/>命令、状态、关联、审计"]
    F --> O["事务 Outbox<br/>不可变领域事件"]
    O --> K["Kafka<br/>幂等消费、分区有序、重放"]
    K --> P["投影与消费层<br/>对账、预警、报表、Agent 上下文"]

    D["数据防腐层<br/>映射、同步、校验、回退"] --> A
    R["规则 / 知识 / 记忆<br/>版本、脱敏、质量评分"] --> F
    J["MySQL 任务状态机<br/>重试、补偿、人工审批"] --> K
    G["全链路治理<br/>权限、数据合同、对账、证据链"] --- C
    G --- A
    G --- F
    G --- K
    G --- P
```

同步命令成功表示平台已确定性受理，而不是所有异步投影均已完成。需要最终状态的调用方使用 `--wait`、`job wait` 或查询对应权威实体。

## 4. CLI 产品模型

### 4.1 调用方式

```bash
data-platform --json datasource list
data-platform --project prj_01 development query execute --sql-file query.sql
data-platform quality task run task_01 --wait
data-platform reporting dashboard export dash_01 --format docx --output report.docx

# 无子命令时进入 REPL
data-platform
data-platform[prod/project-a]> datasource list
```

一次性命令和 REPL 共享命令定义、校验、权限元数据、输出格式和执行上下文，不维护两套实现。

### 4.2 业务命令组

- 基础：`auth`、`config`、`project`、`platform`。
- 数据资产：`asset-search`、`data-map`、`standard`。
- 数据接入：`datasource`、`source-research`、`ingestion`、`ingestion ai-config`、`file-import`。
- 模型与建模：`model-provider`、`data-lab`。
- 开发与质量：`development`、`development ai-config`、`quality`。
- 服务与报表：`service`、`service invoke`、`reporting`、`reporting ai-config`。
- 平台管理：`knowledge-base`、`system`、`system doctor`。
- 语义与验收：`ontology`、`acceptance aviation-ontology`。
- 治理与可靠性：`event`、`job`、`reconcile`、`audit`、`daemon`。

命令组允许多个 API alias 或多个页面入口汇聚到同一 application capability，但每条命令必须通过 `sourceApiKeys` 和 `sourceFrontendKeys` 反向列出覆盖来源。一个 API 只能在明确标注 alias 时与另一 API 共用 capability，避免“看起来有相似命令”却遗漏不同业务语义。

### 4.3 统一命令规则

- 所有命令支持 `--help` 和全局 `--json`。
- 列表命令统一支持分页、筛选和字段选择。
- 复杂创建或更新通过 `--file` 接收 JSON/YAML；敏感值通过交互输入、stdin 或钥匙串引用提供。
- 长任务统一支持 `--wait`、`--timeout`，并返回可用于 `job status` 的任务 ID。
- 删除、覆盖、发布、生产执行、重放和补偿等危险命令要求交互确认；非交互调用必须显式传入 `--yes`。
- 幂等写命令接受 `--idempotency-key`。重复键返回原受理结果，不重复执行业务副作用。
- 业务支持时提供 `--dry-run`，结果明确标识未提交。
- CLI 输出包含 `auditId`；异步操作同时包含 `commandId`、`jobId` 或事件关联 ID。

## 5. 命令注册表与业务适配

命令注册表是帮助文本、参数 schema、权限校验、危险等级、文档和 `SKILL.md` 的单一事实来源。每条命令声明：

```js
{
  command: "quality task run",
  capabilityId: "quality.task.run",
  sourceApiKeys: ["POST /api/v1/quality-control/tasks/:id/run"],
  sourceFrontendKeys: ["/dashboard/quality-control/tasks"],
  modules: ["quality"],
  action: "execute",
  mutates: true,
  destructive: false,
  idempotent: true,
  inputSchema,
  outputSchema,
  handler
}
```

命令数据流：

```text
参数 / stdin / JSON或YAML文件
          ↓
Command Schema（解析、默认值、Zod 校验）
          ↓
ExecutionContext（会话、权限、项目、审计）
          ↓
Application Service（Web 与 CLI 共享）
          ↓
Repository / MySQL / DataX / Kafka / JDBC
          ↓
Result DTO → human table / JSON / NDJSON / 文件
```

目录职责建议如下：

```text
backend/src/
├── application/                  # Web 与 CLI 共享的用例编排
│   └── <domain>/
├── common/policies/              # 会话、权限、项目、license/activation policy
├── infrastructure/events/        # Outbox、Inbox、Kafka、事件合同
├── infrastructure/jobs/          # 持久化任务状态机、租约、重试、补偿
└── modules/                       # 现有模块；controller 逐步瘦身

packages/data-platform-cli/
├── package.json                  # @johnason/data-platform-cli
├── bin/data-platform.js
└── src/
    ├── commands/<domain>/        # 参数与 Result DTO 适配
    ├── registry/                 # 命令元数据与能力清单
    ├── runtime/                  # profile、钥匙串、连接池、上下文、审计
    ├── output/                   # human、JSON、NDJSON、文件、脱敏
    ├── repl/                     # 默认交互模式
    └── daemon/                   # scheduler、worker、PID、锁、日志
```

现有 controller 不被 CLI 调用。需要共享的 controller 编排逻辑移入 application service；controller 只处理 HTTP 输入输出，CLI adapter 只处理命令行输入输出。

## 6. Profile、钥匙串与登录会话

### 6.1 环境 Profile

`data-platform config profile add <name>` 创建环境。普通配置文件只保存：

- profile 名称；
- MySQL 主机、端口、数据库名和用户名；
- Kafka、DataX、JDBC 等非敏感运行时位置或引用；
- 当前 profile 和当前项目。

数据库密码存入 macOS Keychain、Windows Credential Manager 或 Linux Secret Service。若平台无法使用系统钥匙串，命令明确失败并给出修复指引，不退化为明文文件。

### 6.2 登录

`data-platform auth login` 从钥匙串读取数据库凭据，通过隐藏输入读取平台用户密码，调用现有 `authService.login()`。用户密码只在当前进程内短暂存在，不保存。生成的短期 JWT 和会话标识保存在系统钥匙串。

`auth logout` 撤销数据库会话并删除钥匙串中的短期令牌。会话空闲超时、过期、撤销、用户停用或权限变化均在下一条命令执行时生效。

## 7. ExecutionContext 与权限一致性

每条需要登录的业务命令执行以下流程：

1. 根据 profile 建立隔离的 MySQL 连接池。
2. 验证 JWT 签名并在 `auth_sessions` 中验证活动会话。
3. 触碰会话活跃时间，重新读取用户 profile。
4. 根据命令注册表检查模块权限和只读动作权限。
5. 解析 `--project`、profile 当前项目或用户默认项目，验证项目成员关系。
6. 创建 `auditId`、`commandId`、principal 和 trace 上下文。
7. 使用现有 `AsyncLocalStorage` 项目上下文调用 application service。
8. 完成输出脱敏，释放连接、Kafka/JDBC 等本次调用资源。

Web 中间件也逐步调用相同 policy，而不是继续单独维护 URL 到权限的隐式规则。迁移期间保留契约测试，确保现有 API 权限行为不变。

License 与 activation policy 首期返回允许，与当前空中间件行为一致；调用点和接口真实存在，未来启用规则时 Web 与 CLI 可同步生效。

## 8. 同步事务、事实与 Outbox

### 8.1 本地事务边界

一个写命令在同一 MySQL 事务中完成：

1. 幂等键占用或原结果查询；
2. 权威业务数据写入；
3. 命令受理与审计事实追加；
4. 一个或多个 Outbox 事件追加；
5. 幂等结果固定；
6. 事务提交。

任一步失败则全部回滚。CLI 只在提交成功后返回成功。

### 8.2 不可变事实

Outbox 业务事实只追加，不通过更新事件正文来标记投递。事件至少包含：

- `eventId`、`eventType`、`eventVersion`；
- `occurredAt`、`projectId`、`aggregateType`、`aggregateId`；
- `actor`、`commandId`、`auditId`、`correlationId`、`causationId`；
- 数据合同版本、脱敏后的 payload 与可验证摘要。

投递租约、尝试次数、Kafka offset 和最后错误存放在独立 delivery 表，保留原始事件证据。

## 9. Kafka、Inbox 与投影

- Kafka key 使用 `projectId + aggregateType + aggregateId`，保证同一业务实体在分区内有序。
- producer 使用稳定事件 ID；consumer 先写 Inbox 幂等记录，再执行投影或副作用。
- consumer 失败根据错误分类进入立即重试、延迟重试或死信；不可重试错误直接进入人工处置。
- `event replay` 只重放选定事件范围，并要求权限、原因、确认和审计；重放不会修改原事件。
- 对账、预警、报表和 Agent 上下文优先读取派生投影；交易状态和强一致判断读取权威业务表。
- 投影必须可由不可变事件重建，并记录 projection checkpoint、版本和数据合同。

## 10. 无 HTTP Daemon 与任务状态机

### 10.1 Daemon 职责

`data-platform daemon` 不启动 Express，不监听 HTTP 端口。每个 profile 最多运行一个 daemon，负责：

- Outbox 发布；
- Kafka consumer 与投影；
- 现有 ingestion、development、data-lab、quality、备份等 scheduler；
- MySQL 持久化任务 worker；
- 必要的数据服务 runtime；
- 重试、死信、补偿与人工审批后的恢复。

命令包括 `start`、`status`、`logs`、`restart`、`stop` 和前台 `run`。PID 文件与进程锁防止同 profile 重复启动。

启动时检查数据库连接、schema 版本、DataX、Kafka、JDBC 与驱动状态，但不隐式执行 migrate 或 seed。迁移与初始化必须由显式 `system migrate`、`system seed` 完成。

### 10.2 任务状态机

任务状态为：

```text
pending → running → succeeded
             ├──→ waiting_approval → pending
             ├──→ compensating → succeeded | failed
             └──→ failed
```

worker 使用数据库租约抢占任务，租约包含 owner、截止时间与心跳。daemon 崩溃后，过期租约可被其他 worker 回收。重试策略保存尝试次数、下次执行时间、错误分类和退避参数。

不实现通用分布式事务。跨模块失败由显式补偿命令处理，原始事件与补偿事件都保留。人工审批记录审批人、理由、前后状态与证据链。

普通任务以任务创建者为执行 principal；每次实际运行前重新检查账号、模块权限和项目成员关系。系统清理、会话过期和备份任务使用明确的 `system` principal 并写审计记录。

daemon 退出时停止领取新任务，等待当前事务到安全点，提交 checkpoint，然后关闭连接池、Kafka 与 JDBC 资源。

## 11. 数据防腐层与规则、知识、记忆

DataX、外部数据库、Kafka、模型供应商和文件导入统一通过 adapter 进入应用层。adapter 负责：

- 外部字段到平台数据合同的映射；
- 类型、版本、必填项和边界校验；
- 可重试与不可重试错误分类；
- 超时、回退和熔断边界；
- 凭据引用和输出脱敏；
- 外部请求与内部审计 ID 关联。

规则、知识和 Agent 记忆均带版本、项目范围、来源、脱敏级别和质量评分。Agent 上下文从经过治理的事实与投影生成，不直接拼接原始数据库记录或日志。

## 12. 输出、文件与错误契约

### 12.1 输出

- human 模式使用表格、摘要和清晰诊断。
- JSON 模式 stdout 只输出一个 `{success,data,meta,auditId}` 文档，日志写 stderr。
- AI 流式事件和运行日志在 JSON 模式使用 NDJSON，每行包含稳定 `type`。
- DOCX、Excel、PDF、导入文件必须使用 `--output` 或 `--file`，不向 stdout 混入二进制。
- 密码、Token、模型密钥、数据库连接密码在任何模式中都不可返回。

### 12.2 错误

```json
{
  "success": false,
  "error": {
    "code": "MODULE_PERMISSION_FORBIDDEN",
    "message": "当前角色无权访问该功能模块",
    "retryable": false,
    "details": {}
  },
  "auditId": "..."
}
```

退出码稳定区分：成功、输入无效、未登录、权限不足、资源不存在、冲突、依赖不可用、部分成功和内部错误。自动重试只用于命令注册表明确标记为幂等、且错误被分类为可重试的操作。

## 13. 审计、对账与证据链

所有命令和后台任务贯穿 `auditId`、`commandId`、`correlationId` 与 `causationId`。`audit show` 可从命令受理追踪至业务事实、Outbox、Kafka、Inbox、投影、任务、补偿与最终输出。

`reconcile` 比较权威业务表、事实、Outbox 投递、Kafka 消费 checkpoint 和关键投影，生成差异而不自动覆盖。修复必须通过显式、可审计的补偿或重建命令执行。

## 14. 测试与验收

### 14.1 五层测试

1. **单元测试**：命令 schema、注册表、输出、脱敏、权限映射、幂等键、任务状态机和错误分类。
2. **共享服务契约测试**：同一输入分别经过 Web controller 与 CLI adapter，验证权限判定与业务结果一致。
3. **集成测试**：使用真实 MySQL 与 Kafka，验证本地 ACID + Outbox、Inbox 去重、分区顺序、重试、死信、重放、租约回收和补偿。
4. **CLI/daemon E2E**：全局安装后从任意目录调用，验证登录、profile、项目切换、全平台关键闭环、文件导入导出、daemon 重启和崩溃恢复。
5. **Agent 验收**：Agent 仅依赖 `--help`、`SKILL.md` 和 JSON 输出完成数据接入、开发、质量、服务与报表端到端任务。

### 14.2 全平台完成条件

- 覆盖清单必须显示 `596/596` API、`84/84` 前端入口已映射，且 unmapped、duplicate key、unknown group 和 stale fingerprint 均为 0。
- 每条 API 必须关联已注册 capability，并在 registry 中保留 `sourceApiKeys`；每个前端入口必须关联 `sourceFrontendKeys`。
- 所有清单项必须是 `verified` 或经审查的 `notApplicable`；`designed`、`implemented` 均不能进入正式发布。
- 每个业务域至少有一个使用真实数据库的闭环测试。
- 所有危险命令、长任务、流式输出和文件输入输出均有 subprocess 测试。
- Outbox/Inbox、任务状态机、重试、死信、重放、补偿和证据链均有故障注入测试。
- 现有 Web API 回归测试全部通过。
- `npm pack` 后的包可全局安装，`data-platform --help`、REPL、JSON 输出和 daemon 可从任意目录运行。
- `SKILL.md` 自包含安装、命令组、JSON/NDJSON、错误处理、危险操作和真实工作流示例。

### 14.3 `build-aviation-ontology` Skill 端到端验收

CLI 的业务验收基准采用用户提供的外部 `build-aviation-ontology/SKILL.md`。由于该 Skill 源文件不属于本仓库，设计以内容摘要锁定版本：

| Skill 资产 | SHA-256 |
|---|---|
| `build-aviation-ontology/SKILL.md` | `be6646cfa4e499e21c97152ee5b2311afbd0a2f995e4966af7656e47ea03f64c` |
| `build-aviation-ontology/references/reference-workflow.md` | `474ea88c6bcdb0662515f4117a8f14eaa9ba2182eec2a0bc26bd4bfd80b2199f` |

完整机器验收规范见 [`aviation-ontology-cli-acceptance.json`](./aviation-ontology-cli-acceptance.json)。该规范把 Skill 的环境基线、数据接入、RED 首轮试跑、ODS 治理、本体与血缘、平台装载、GREEN 验收七个阶段映射到明确 CLI 命令、证据和失败条件。

#### 14.3.1 验收结论标准

验收目标不是证明 596 个 API 都有命令名称，而是证明一个 Agent 仅阅读以下三类材料即可完成真实业务闭环：

1. `build-aviation-ontology/SKILL.md`；
2. `data-platform --help` 与各级命令帮助；
3. CLI 的 JSON/NDJSON 输出和生成的本地证据文件。

除安装/启动 CLI、提供非敏感输入文件、向系统钥匙串注入凭据引用、启动外部依赖外，Agent 对平台的所有读取、写入、上传、等待、导出、验证和证据采集都必须经由 `data-platform`。以下旁路一律使验收失败：

- `curl` 或直接 HTTP；
- 浏览器操作代替平台验证；
- `mysql`、`psql` 或其他直连数据库客户端；
- 直接 import backend controller/service/repository；
- 执行 `bootstrap-aviation-demo.js` 或其他仓库 bootstrap 脚本；
- 人工修改数据库以使验收变绿。

CLI 内部可以复用 application service、adapter、DataX/JDBC 和数据库事务；禁止的是 Agent 绕开 CLI 接口。验收工具通过进程审计、命令轨迹和证据链记录检测旁路。

#### 14.3.2 七阶段 CLI 验收链路

| 阶段 | 必须由 CLI 完成的能力 | 核心证据 |
|---|---|---|
| 环境与基线 | `system doctor`、项目唯一反查、写权限检查、资产包预检、依赖/基线检查 | 实际 project ID、profile、依赖状态、既有失败分类 |
| 数据接入与 ODS | 数据源测试、API/文件预览、任务创建、运行、等待、运行明细 | 输入/过滤/写入/拒绝数、目标表、业务键、游标、异常值处理 |
| RED 首轮试跑 | 创建质量任务、运行、保存不可变快照、生成报告 | NULL/空串/重复/类型/时序/代码/关系统计及预期失败 |
| ODS 治理 | 预检 SQL、事务化治理 SQL、标准元、字段映射、字典和质量规则 | 前后计数、无丢行、原始重复保留、消费层去重 |
| 本体与血缘 | 契约验证/导入/比对，血缘验证/导入，规则可执行性检查 | 实体/关系/规则、连接条件、字段键角色、无悬空引用 |
| 平台装载 | 数据地图、调研、逻辑/物理模型、知识库、报表、图谱、模拟页 | 可查询 ID、资源数大于 0、知识解析/向量就绪、真实报表行、HTML 产物 |
| GREEN 最终验收 | RED→GREEN 对比、搜索/报表 runtime、图谱一致性、对账和报告 | 最新运行证据、完整证据链、限制/跳过项、无敏感信息 |

历史航空 Demo 可作为固定回归夹具：项目编码 `aviation_ontology_demo`、7 张 ODS 表、89 行、5 个实体、3 类关系、2 条规则，以及曾验证的 40 节点/57 边/5 层图谱。但这些值仅在明确选择历史 Demo 契约时生效；新航空项目必须从输入合同推导期望计数，禁止把历史 ID `7`、数据源 ID或历史计数硬编码为通用断言。

#### 14.3.3 为 Skill 补充的 CLI 原生能力

596 条 API 映射覆盖平台现有业务表面，但 Skill 还需要跨模块语义合同与验收编排。新增以下 CLI 原生命令组；它们不新增第二套业务逻辑，而是组合已注册 capability 并调用共享 application service：

```text
data-platform ontology contract validate|import|show|diff
data-platform ontology lineage validate|import|show
data-platform ontology graph export|verify
data-platform ontology simulation export|verify
data-platform acceptance aviation-ontology preflight|run|verify|report
```

- `ontology contract` 使用版本化 JSON 作为实体、关系和规则的单一事实来源，并验证 Markdown、SQL、模型和图谱的一致性。
- `ontology lineage` 要求每条边具备主语、宾语、源/目标表、源/目标字段、键角色和连接条件，拒绝悬空端点。
- `ontology graph export` 生成单文件离线 HTML，支持搜索、筛选、详情、分层与力导向布局；`verify` 机器比对合同与 HTML 节点/边。
- `ontology simulation export` 将天气、延误、容量、值勤/休息约束映射为可解释决策，并提供结构校验。
- `acceptance aviation-ontology run` 是可恢复的 daemon job，按七阶段记录 checkpoint；它只编排普通 CLI capability，不能调用历史 bootstrap 脚本或直接写库。
- `verify` 必须重新读取权威数据和最新运行状态，不接受仅凭命令退出码或旧产物通过。
- `report` 输出项目、分支/提交、环境、实际 ID、接入计数、RED/GREEN 对比、语义资产计数、知识库/图谱/报表路径、测试证据、限制与跳过项；先经过统一脱敏。

此外，下列跨接口操作必须提供 CLI 原生 facade，并在内部回落到已有 application capability：`project resolve`、`project access check`、`standard field-mapping apply`、`knowledge-base wait`、`knowledge-base search`、`reconcile project`。这些 facade 不能直接操作 repository，也必须进入权限、项目、幂等、审计和覆盖注册表。

#### 14.3.4 必须判定失败的条件

以下任一项发生，航空本体 Skill 验收状态必须为 `failed`，不能标记“部分成功”或“端到端通过”：

- CLI 项目上下文、治理执行和平台资产的 project ID 不一致；
- ODS 元数据数量为 0，或数据地图资源数量为 0；
- 关系端点或字段血缘存在悬空引用；
- 知识库未同步、解析失败或向量未就绪；
- 报表引用错误数据源，或数据集未实际返回结果；
- 脏数据导致约束治理仅执行一部分；
- 使用任何禁止旁路完成平台操作或验证；
- Oracle、达梦、外部 API 等真实依赖不可用，却仍宣称端到端通过。

依赖确实不可用时可以记录 `skipped` 或 `limited`，但报告必须列出未验证边界；硬失败项不能被 skip 覆盖。

#### 14.3.5 自动化通过门槛

正式发布候选必须在干净环境中运行两次：第一次完成构建，第二次验证幂等重跑。两次均由安装后的 `data-platform` 命令从任意目录执行，并满足：

```text
acceptance workflow status             = succeeded
forbidden bypass count                 = 0
project ID mismatch                    = 0
ODS metadata count                     > 0
data-map resource count                > 0
dangling semantic endpoints            = 0
dangling lineage references            = 0
knowledge documents parse-success      = all
knowledge documents vector-ready       = all
report dataset real result rows        > 0
graph contract mismatch                = 0
second-run duplicate business keys     = 0
secret scan findings                   = 0
```

专项测试还必须覆盖固定 Demo 回归、动态项目 ID、METAR `VRB`/`M`/`6+`、无当前报文的 `NO_CURRENT_REPORT`、脏数据事务回滚、daemon 中断恢复、知识库超时重试、错误报表数据源、旧图谱与新合同不一致、真实依赖缺失时禁止虚假成功。

## 15. 分阶段交付

全平台能力进入首个正式版本，但采用垂直闭环分批实现：

1. CLI 基础运行时：package、registry、profile、钥匙串、登录、ExecutionContext、输出与 REPL。
2. 可靠性底座：审计事实、幂等命令、Outbox/Inbox、Kafka、任务状态机和 daemon。
3. 核心数据闭环：project、datasource、development、ingestion、quality。
4. 资产与建模：asset-search、data-map、standard、source-research、file-import、model-provider、data-lab。
5. 服务与消费：service、reporting、knowledge-base、system。
6. 将 596 条 API 和 84 个前端入口的追踪状态逐项收口，全域 E2E、故障注入、Agent 验收、文档与 npm 包验证。

每个阶段都必须保持 Web API 回归通过，并交付可独立验证的命令闭环。

## 16. 风险与约束

- 当前 controller 中可能包含未下沉的业务编排。必须逐用例迁入 application service，避免 CLI 复用 HTTP 对象或复制逻辑。
- 当前 URL 权限映射存在模块命名历史差异。命令注册表使用显式模块与 action，迁移时通过契约测试锁定现有行为并单独处理不一致项。
- npm 全局包直连多种原生或可选数据库驱动，安装兼容性风险高。包应按能力延迟加载驱动，并在 `system doctor` 中给出精确诊断。
- Kafka 或 daemon 暂时不可用时，同步业务事务仍可提交并积压 Outbox；系统必须暴露 backlog、最老事件年龄和恢复状态。
- 全平台范围较大，能力清单是范围控制和完成判定的唯一依据；不得以“已有通用命令”替代逐路由核对。
