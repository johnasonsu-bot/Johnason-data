> 语言：[简体中文](./2026-08-12-cli-single-stage.zh-CN.md) | [English](./2026-08-12-cli-single-stage.en.md)

# Data Platform CLI 全量转换单阶段实施方案

> **针对智能代理工作者：** 必须具备的子技能：建议使用 superpowers:subagent-driven-development 或 superpowers:executing-plans 按任务逐项实施本方案。步骤使用复选框 (`- [ ]`) 语法进行跟踪。

**目标：** 在单个阶段内完成 Data Platform CLI 的全量转换，将所有业务命令分类为 external-API 和/或数据库访问，并通过 API 风险门禁，随后通过 MySQL、PostgreSQL、Oracle 和 Dameng 数据库门禁。

**架构：** 已安装的 CommonJS CLI 与 Express 共享传输无关的应用能力。通过声明式 registry 将 596 个源 API 和 84 个前端入口绑定至处理器、权限、执行目标、I/O 契约、审计/Outbox/任务行为及测试。构建完成后，无需修改即可在两个有序门禁中进行测试：首先是外部 API 调用，其次是四引擎数据库访问。

**技术栈：** Node.js 22.20+, Commander 15, Zod 3.24, MySQL2, pg, oracledb, dmdb/managed JDBC, KafkaJS, DataX, Node test runner, Docker/真实数据库测试环境, npm 全局打包。

## 全局约束

- 本方案仅包含一个实施阶段；任务组和提交仅作为内部检查点。
- CLI 绝不调用 Data Platform Express/HTTP。
- `api` 指应用能力调用外部 API、模型提供商或已发布的业务运行时。
- `database` 引擎仅限 `mysql`、`postgresql`、`oracle` 和 `dm`。
- 复合命令需声明并测试其实际使用的所有目标。
- 最终数据库门禁必须使用真实的 Oracle 和 DM；基础设施不可用将导致任务无法完成。
- 密钥严禁进入常规配置、stdout、stderr、证据 JSON、事件负载、fixtures 或 Git。
- 所有 596 个 API 和 84 个前端入口最终状态须为 `verified` 或经评审的 `notApplicable`。
- 航空本体 (aviation ontology) 工作流需通过已安装的 CLI 运行两次，且严禁任何违规绕过。
- 全程采用 TDD 并保持 Web 行为一致性。

---

## 任务组 1：基础运行时

执行 [`2026-08-12-cli-foundation.md`](./2026-08-12-cli-foundation.md) 中的所有任务。这将产出可安装包、keychain、profiles、数据库运行时注入、共享策略、registry/output、基础命令、REPL 以及已安装命令测试。这并非发布版本或独立阶段。

基础方案的任务 1–3 已完成。权威的剩余执行顺序如下：

1. 共享核心 Tasks 1–6：workspace, 内核, auth/project 包及打包聚合体。
2. 基础 Tasks 6–9：CLI 输出, registry, 命令, REPL 及已安装基础测试。
3. 主任务 Tasks 10–12：目标分类、可靠事件/任务以及无-HTTP 守护进程。
4. 共享核心 Tasks 7–9 (主任务 Task 13)：风险证据及所有 21 个模块迁移（含回退/重新升级）。
5. 主任务 Tasks 14–16：完整的 CLI 树、四引擎契约及航空本体验收。
6. 主任务 Tasks 17–18 随后执行共享核心 Task 10：外部 API 门禁、四个真实数据库门禁及聚合验收。

此排序取代了此前 CLI 可以直接导入 `backend/src/application/*` 的假设。如果其他任务与共享核心计划发生冲突，应以已批准的共享核心设计和计划为准。

在继续之前，请运行：

```bash
cd packages/data-platform-cli && npm test && npm run pack:check
cd ../../backend && npm test
```

预期结果：所有基础测试及现有 backend 测试均通过。

### Task 10: 在制品仓库中强制执行执行目标分类

**文件：**
- 修改：`packages/data-platform-cli/src/registry/command-registry.js`
- 新建：`packages/data-platform-cli/src/registry/execution-targets.js`
- 新建：`packages/data-platform-cli/tests/execution-targets.test.js`
- 修改：`scripts/generate-cli-coverage-baseline.js`
- 修改：`docs/superpowers/specs/data-platform-cli-coverage-baseline.json`

**接口：**
- `validateExecutionTargets(targets) -> normalized targets`。
- `resolveRuntimeTargets(definition, input, result) -> [{ kind, provider|engine, role? }]`。
- 允许的 API 提供商：`external-api`, `model-provider`, `service-runtime`。
- 允许的数据库引擎：`mysql`, `postgresql`, `oracle`, `dm`；仅限本地的定义使用 `{ kind:"local" }`。

- [ ] **步骤 1：编写失败的分类测试**

```js
assert.throws(() => registry.register({ ...business, executionTargets: [] }), /executionTargets/);
assert.throws(() => validateExecutionTargets([{ kind: "database", engine: "sql" }]), /unsupported database engine/);
assert.deepEqual(validateExecutionTargets([
  { kind: "api", provider: "external-api" },
  { kind: "database", engine: "postgresql", role: "business-datasource" }
]), [
  { kind: "api", provider: "external-api" },
  { kind: "database", engine: "postgresql", role: "business-datasource" }
]);
```

- [ ] **步骤 2：运行并观察失败情况**

运行：`node --test packages/data-platform-cli/tests/execution-targets.test.js`

预期结果：失败，因为缺少执行目标验证。

- [ ] **步骤 3：实现验证逻辑并生成 JSON 凭证**

使用 Zod strict objects 拒绝未知键。对精确版本的目标进行去重。要求非本地业务命令必须包含 `api` 或 `database`。在 `meta.executionTargets` 中添加实际的运行时目标；动态数据源命令需将声明的引擎候选者替换为从数据源配置中解析出的引擎。

- [ ] **步骤 4：重新生成并验证设计基准**

运行：

```bash
node scripts/generate-cli-coverage-baseline.js '/Users/sushi/Downloads/data-platform-dev/source/api-inventory.json' docs/superpowers/specs/data-platform-cli-coverage-baseline.json
jq -e '.gates.unclassifiedBusinessCommands == 0 and .gates.apiClassified > 0 and .gates.databaseClassified.mysql > 0 and .gates.databaseClassified.postgresql > 0 and .gates.databaseClassified.oracle > 0 and .gates.databaseClassified.dm > 0' docs/superpowers/specs/data-platform-cli-coverage-baseline.json
```

预期结果：通过。

- [ ] **步骤 5：提交分类实现**

```bash
git add packages/data-platform-cli/src/registry packages/data-platform-cli/tests/execution-targets.test.js scripts/generate-cli-coverage-baseline.js docs/superpowers/specs/data-platform-cli-coverage-baseline.json
git commit -m "feat(cli): classify API and database command targets"
```

### Task 11: 添加审计、幂等、Outbox、Inbox 及持久化任务 Schema

**文件：**
- 新建：`packages/data-platform-core-kernel/src/infrastructure/cli-runtime.migration.js`
- 新建：`packages/data-platform-core-kernel/src/infrastructure/command.repository.js`
- 新建：`packages/data-platform-core-kernel/src/infrastructure/event.repository.js`
- 新建：`packages/data-platform-core-kernel/src/infrastructure/job.repository.js`
- 新建：`packages/data-platform-core-kernel/tests/cli-runtime.test.js`
- 修改：`backend/src/database/migrate.js`
- 修改：`packages/data-platform-core-kernel/src/runtime/execution-context.js`

**接口：**
- `acceptCommand({ idempotencyKey, capabilityId, actor, projectId, inputDigest }, connection)`。
- `appendEvent({ eventId, eventType, aggregate, payload, auditId, commandId }, connection)`。
- `enqueueJob({ type, input, actor, projectId, maxAttempts }, connection)`。
- 任务状态：`pending`, `running`, `waiting_approval`, `compensating`, `succeeded`, `failed`。

- [ ] **步骤 1：编写失败的迁移/仓库测试**

测试使用可丢弃的 MySQL schema，并断言单个事务可以写入业务 fixture 数据、command acceptance、audit 以及 Outbox；强制失败将使这四项全部回退。重复的 `(project_id, capability_id, idempotency_key)` 将返回原始结果引用。Event payload 是不可变的，而 delivery 尝试记录在单独的表中。

- [ ] **步骤 2：运行并观察失败**

运行：`node --test packages/data-platform-core-kernel/tests/cli-runtime.test.js`

预期：FAIL，因为缺少 migration 和 repositories。

- [ ] **步骤 3：实现精确的表和索引**

创建表 `cli_commands`、`cli_audit_facts`、`domain_events`、`event_deliveries`、`event_inbox`、`durable_jobs`、`durable_job_attempts` 和 `durable_job_approvals`。仅对脱敏的 contracts 使用 JSON 列；单独存储 payload 的 SHA-256。添加唯一的 event ID、idempotency key、Inbox consumer/event、job lease 以及 project/time 索引。

- [ ] **步骤 4：集成事务包装器**

Kernel 的 `execution-context.js` 暴露 `context.transaction(handler)`，并确保 command acceptance、业务变更、audit、event append 和结果固化共享注入的 MySQL 连接。

- [ ] **步骤 5：运行测试并提交**

运行：`node --test packages/data-platform-core-kernel/tests/cli-runtime.test.js backend/src/database/migrate.test.js`

预期：PASS。

```bash
git add packages/data-platform-core-kernel/src/infrastructure packages/data-platform-core-kernel/tests/cli-runtime.test.js backend/src/database packages/data-platform-core-kernel/src/runtime/execution-context.js
git commit -m "feat(core): persist CLI audit events and durable jobs"
```

### 任务 12：实现 Kafka Delivery 与无 HTTP Daemon

**文件：**
- 创建：`packages/data-platform-core-kernel/src/infrastructure/outbox-publisher.js`
- 创建：`packages/data-platform-core-kernel/src/infrastructure/inbox-consumer.js`
- 创建：`packages/data-platform-core-kernel/src/infrastructure/job-worker.js`
- 创建：`packages/data-platform-core-kernel/src/infrastructure/daemon-runtime.js`
- 创建：`packages/data-platform-core-kernel/tests/daemon-runtime.test.js`
- 创建：`packages/data-platform-cli/src/daemon/process-manager.js`
- 创建：`packages/data-platform-cli/src/commands/daemon.js`
- 创建：`packages/data-platform-cli/tests/daemon.test.js`

**接口：**
- `publishBatch({ limit, leaseMs }) -> { claimed, published, failed }`。
- `consumeEvent(consumerName, event, handler) -> duplicate-safe result`。
- `claimJobs({ workerId, limit, leaseMs }) -> jobs`。
- CLI：`daemon start|run|status|logs|restart|stop`。

- [ ] **步骤 1：编写失败的故障注入测试**

测试 commit-after-publish、Kafka 重复 delivery、有序 entity keys、retry backoff、dead-letter 转换、过期 lease 回收、优雅停机、PID lock，并断言没有打开任何网络监听器。

- [ ] **步骤 2：运行并观察失败**

运行：`node --test packages/data-platform-core-kernel/tests/daemon-runtime.test.js packages/data-platform-cli/tests/daemon.test.js`

预期：FAIL，由于缺少模块。

- [ ] **步骤 3：实现 publisher、consumer、worker 和进程控制**

Kafka key 为 `${projectId}:${aggregateType}:${aggregateId}`。Inbox 插入和 projection 变更共享一个 MySQL 事务。PID/lock/log 文件在 CLI 数据目录中按 profile 范围划分。`daemon run` 启动现有的 schedulers 以及 publisher/consumer/job 循环，绝不导入 `app.js` 或调用 `listen()`。

- [ ] **步骤 4：运行测试并提交**

```bash
node --test packages/data-platform-core-kernel/tests/daemon-runtime.test.js packages/data-platform-cli/tests/daemon.test.js
git add packages/data-platform-core-kernel/src/infrastructure packages/data-platform-core-kernel/tests/daemon-runtime.test.js packages/data-platform-cli/src/daemon packages/data-platform-cli/src/commands/daemon.js packages/data-platform-cli/tests/daemon.test.js
git commit -m "feat(cli): add durable no-HTTP daemon"
```

### 任务 13: 打包所有领域应用能力

按照 [`2026-08-12-shared-core-packaging-and-risk-gates.md`](./2026-08-12-shared-core-packaging-and-risk-gates.md) 执行任务 7–9。固定迁移矩阵创建 21 个独立版本的模块，其聚合目录包含精确的 596 个 API key 和 84 个前端入口。不要创建 `backend/src/application/capabilities`；能力存在于可发布的模块包中，Controllers 保持为 Web 适配器，且每个模块在任务 14 之前必须通过全部风险门禁及回退/重新升级测试。

### 任务 14: 生成并绑定完整的 CLI 命令树

**文件：**
- 创建：`packages/data-platform-cli/src/registry/domain-commands.js`
- 创建：`packages/data-platform-cli/src/commands/file-io.js`
- 创建：`packages/data-platform-cli/src/commands/job.js`
- 创建：`packages/data-platform-cli/src/commands/event.js`
- 创建：`packages/data-platform-cli/src/commands/audit.js`
- 创建：`packages/data-platform-cli/src/commands/reconcile.js`
- 创建：`packages/data-platform-cli/tests/full-command-tree.test.js`
- 修改：`packages/data-platform-cli/src/main.js`

**接口：**
- `createDomainCommands(capabilityCatalog) -> CommandDefinition[]`。
- `executeCapability(capabilityId, parsedInput, cliContext) -> envelope`。
- 文件适配器在调用处理器前验证路径，且绝不将二进制数据输出至 stdout。

- [ ] **步骤 1：编写失败的命令树测试**

断言所有 596 个 API 密钥和 84 个前端密钥均已表示，所有命令帮助均可渲染，别名是显式的，危险定义需要 `--yes`，流使用 NDJSON，下载需要 `--output`，且长耗时任务需暴露 `--wait/--timeout`。

- [ ] **步骤 2：运行并观察失败情况**

运行：`node --test packages/data-platform-cli/tests/full-command-tree.test.js`

预期：FAIL，提示缺少源密钥。

- [ ] **步骤 3：将目录绑定到层级化的 Commander 命令**

使用能力 ID 生成经批准的领域组。复杂负载接受 `--file` JSON/YAML。位置 ID 和查询标志由每个输入 schema 定义。CLI 执行通过共享上下文、事务/幂等、审计和输出渲染器。

- [ ] **步骤 4：运行完整的树测试和已安装的帮助测试**

运行：`node --test packages/data-platform-cli/tests/full-command-tree.test.js packages/data-platform-cli/tests/full-e2e.test.js`

预期：PASS，制品仓库覆盖率为 596/596 和 84/84。

- [ ] **步骤 5：提交完整的命令树**

```bash
git add packages/data-platform-cli/src packages/data-platform-cli/tests/full-command-tree.test.js
git commit -m "feat(cli): expose every platform capability as commands"
```

### 任务 15: 完成四引擎数据库适配器契约

**文件：**
- 修改：`packages/data-platform-module-data-development/src/adapters/mysql.adapter.js`
- 修改：`packages/data-platform-module-data-development/src/adapters/postgres.adapter.js`
- 修改：`packages/data-platform-module-data-development/src/adapters/managed-jdbc.adapter.js`
- 创建：`packages/data-platform-core-kernel/src/database/capabilities.js`
- 创建：`packages/data-platform-core-kernel/src/database/dialect.js`
- 创建：`packages/data-platform-core-kernel/src/database/contract.js`
- 创建：`packages/data-platform-core-kernel/tests/database-contract.test.js`
- 创建：`packages/data-platform-cli/tests/database-gate.test.js`

**接口：**
- `databaseAdapter(engine) -> { testConnection, listSchemas, listTables, listColumns, sample, execute, begin, commit, rollback }`。
- 引擎：MySQL 原生；PostgreSQL 原生/JDBC；Oracle 和 DM 通过托管 JDBC 或配置的原生适配器。
- 错误统一规范为 `DATABASE_DRIVER_MISSING`、`DATABASE_CONNECTION_FAILED`、`DATABASE_QUERY_FAILED` 或 `DATABASE_TRANSACTION_FAILED`。

- [ ] **步骤 1：编写失败的共享适配器合约**

该统一合约用于检查所有四个适配器的标识符引用、占位符风格、分页、类型规范化、事务回退、连接清理以及敏感信息脱敏。添加 Oracle service-name/SID 和 DM JDBC URL 的测试 fixture。

- [ ] **步骤 2：运行并观察引擎差异**

运行：`node --test packages/data-platform-core-kernel/tests/database-contract.test.js`

预期结果：失败，且提示缺少或不一致的适配器方法。

- [ ] **步骤 3：规范化适配器与方言**

MySQL 使用反引号和 `?`；PostgreSQL 使用双引号和 `$n`；Oracle 使用双引号和 `:n` 外加 OFFSET/FETCH；DM 使用双引号及其经过验证的分页/绑定合约。发现机制需遵循 PostgreSQL 的 `public` 模式以及 Oracle/DM 的显式/大写模式。

- [ ] **步骤 4：实现真实引擎风险门禁测试套件**

`database-gate.test.js` 从基于 keychain 的测试配置中读取连接引用，创建唯一命名的测试 schema/表，执行分类命令，回退破坏性 fixture，并仅打印脱敏后的证据。当 `CLI_DATABASE_GATE=1` 时，必须拒绝使用 mock 适配器。

- [ ] **步骤 5：运行适配器单元合约并提交**

运行：`node --test packages/data-platform-core-kernel/tests/database-contract.test.js`

预期结果：方言/单元合约通过；真实门禁将在最终的 Task 18 中运行。

```bash
git add packages/data-platform-module-data-development/src/adapters packages/data-platform-core-kernel/src/database packages/data-platform-core-kernel/tests/database-contract.test.js packages/data-platform-cli/tests/database-gate.test.js
git commit -m "feat(cli): normalize MySQL PostgreSQL Oracle and DM access"
```

### Task 16: 实现 Ontology Facade 与 Aviation Acceptance 任务

**文件：**
- 创建：`packages/data-platform-core/src/ontology/contract.js`
- 创建：`packages/data-platform-core/src/ontology/lineage.js`
- 创建：`packages/data-platform-core/src/ontology/graph.js`
- 创建：`packages/data-platform-core/src/ontology/simulation.js`
- 创建：`packages/data-platform-core/src/ontology/aviation-acceptance.js`
- 创建：`packages/data-platform-core/tests/aviation-acceptance.test.js`
- 创建：`packages/data-platform-cli/src/commands/ontology.js`
- 创建：`packages/data-platform-cli/src/commands/aviation-acceptance.js`
- 创建：`packages/data-platform-cli/tests/aviation-acceptance.test.js`

**接口：**
- 命令需与 `aviation-ontology-cli-acceptance.json` 完全匹配。
- 验收运行会持久化七个检查点，并生成 `preflight`、`ingestion`、`red`、`governance`、`ontology`、`platform-load` 和 `green` 证据。
- 图谱验证（Graph verify）将合约节点/边与嵌入的 HTML 数据进行对比；仿真验证（simulation verify）检查决策规则引用。

- [ ] **步骤 1：编写失败的七阶段测试**

使用历史 Demo 合约 fixture，但注入动态的项目/数据源 ID。测试项目不匹配、元数据/资源计数为零、悬空端点、知识未就绪、报告源错误、部分治理、禁止绕过以及不可用依赖导致的伪成功拒绝。

- [ ] **步骤 2：运行并观察失败情况**

运行：`node --test packages/data-platform-core/tests/aviation-acceptance.test.js packages/data-platform-cli/tests/aviation-acceptance.test.js`

预期结果：FAIL，提示缺少 ontology 模块。

- [ ] **步骤 3：实现契约、血缘、图、仿真和编排**

使用版本化 JSON 作为语义权威。通过已注册的能力运行所有平台工作。记录执行过的 capability ID 并进行过程审计；拒绝 curl/浏览器/数据库客户端/bootstrap 提供的证据。生成包含嵌入式规范化契约和确定性哈希的自包含 HTML。

- [ ] **步骤 4：运行 ontology 测试并提交**

```bash
node --test packages/data-platform-core/tests/aviation-acceptance.test.js packages/data-platform-cli/tests/aviation-acceptance.test.js
git add packages/data-platform-core/src/ontology packages/data-platform-core/tests/aviation-acceptance.test.js packages/data-platform-cli/src/commands/ontology.js packages/data-platform-cli/src/commands/aviation-acceptance.js packages/data-platform-cli/tests/aviation-acceptance.test.js
git commit -m "feat(cli): add aviation ontology acceptance workflow"
```

### 任务 17: 测试门禁 1 — 外部 API 调用

**文件：**
- 创建：`packages/data-platform-cli/tests/api-gate.test.js`
- 创建：`packages/data-platform-cli/tests/fixtures/external-api-server.js`
- 创建：`packages/data-platform-cli/tests/fixtures/model-provider-server.js`
- 创建：`packages/data-platform-cli/tests/fixtures/service-runtime-contract.json`
- 修改：`packages/data-platform-cli/tests/TEST.md`

**接口：**
- 门禁枚举包含 `executionTargets.kind === "api"` 的 registry 定义，并要求每个 capability ID 提供证据。
- 受控的外部服务器需支持成功、分页、速率限制、超时、响应格式错误、流式传输、取消和重试场景。

- [ ] **步骤 1：编写门禁并验证其在未测试命令上失败**

运行：`CLI_API_GATE=1 node --test packages/data-platform-cli/tests/api-gate.test.js`

证据完成前的预期结果：FAIL，列出未进行测试的已分类 API capability ID。

- [ ] **步骤 2：为每个已分类的 API capability 添加命令级用例**

调用已安装的 `data-platform` 二进制文件，执行外部 API 源操作、摄取、模型调用、AI/分析命令以及服务运行时。断言 JSON/NDJSON、重试次数、审计/事件 ID、取消、幂等性和脱敏情况。任何测试均不得调用 Data Platform HTTP。

- [ ] **步骤 3：运行完整的 API 门禁**

运行：

```bash
cd packages/data-platform-cli
npm test
CLI_API_GATE=1 node --test tests/api-gate.test.js
```

预期结果：API 已分类数量等于已测试数量；未测试数量为 0；绕过数量为 0；发现的机密信息为 0。

- [ ] **步骤 4：持久化证据并提交**

将完整输出和环境指纹追加到 `TEST.md`。

```bash
git add packages/data-platform-cli/tests packages/data-platform-cli/tests/TEST.md
git commit -m "test(cli): pass external API command gate"
```

### 任务 18: 测试门禁 2 — MySQL, PostgreSQL, Oracle 和 Dameng

**文件：**
- 修改：`packages/data-platform-cli/tests/database-gate.test.js`
- 创建：`packages/data-platform-cli/tests/fixtures/database-contracts/mysql.json`
- 创建：`packages/data-platform-cli/tests/fixtures/database-contracts/postgresql.json`
- 创建：`packages/data-platform-cli/tests/fixtures/database-contracts/oracle.json`
- 创建：`packages/data-platform-cli/tests/fixtures/database-contracts/dm.json`
- 修改：`packages/data-platform-cli/tests/TEST.md`

**接口：**
- 门禁按数据库引擎枚举 registry 定义，并要求为每个已分类的能力提供命令证据。
- `test-mysql`、`test-postgresql`、`test-oracle` 和 `test-dm` 配置必须通过 OS 钥匙串解析凭据。

- [ ] **步骤 1：运行 MySQL 门禁**

运行：`CLI_DATABASE_GATE=1 CLI_DATABASE_ENGINE=mysql node --test packages/data-platform-cli/tests/database-gate.test.js`

预期：所有 MySQL 分类的能力均已测试；CRUD/查询/事务/项目隔离/持久化运行时通过。

- [ ] **步骤 2：运行 PostgreSQL 风险门禁**

运行：`CLI_DATABASE_GATE=1 CLI_DATABASE_ENGINE=postgresql node --test packages/data-platform-cli/tests/database-gate.test.js`

预期：所有 PostgreSQL 分类的能力均已测试；ODS/DataX/JDBC/schema/方言/回退及 aviation 异常值通过。

- [ ] **步骤 3：运行 Oracle 风险门禁**

运行：`CLI_DATABASE_GATE=1 CLI_DATABASE_ENGINE=oracle node --test packages/data-platform-cli/tests/database-gate.test.js`

预期：所有 Oracle 分类的能力均已针对真实 Oracle 实例进行测试；service-name/SID/schema/绑定/分页/回退通过。

- [ ] **步骤 4：运行 DM 风险门禁**

运行：`CLI_DATABASE_GATE=1 CLI_DATABASE_ENGINE=dm node --test packages/data-platform-cli/tests/database-gate.test.js`

预期：所有 DM 分类的能力均已针对真实 DM 实例进行测试；JDBC/schema/绑定/分页/回退通过。

- [ ] **步骤 5：重复运行两次 aviation 验收**

使用已批准的 aviation 合约运行两次已安装的 CLI。预期：两次均成功；第二次运行不产生重复业务键；bypass 计数为 0。

- [ ] **步骤 6：运行最终回归与打包检查**

```bash
cd packages/data-platform-cli && npm test && npm run pack:check
cd ../../backend && npm test
cd ../frontend && npm run build
cd ..
node scripts/generate-cli-coverage-baseline.js '/Users/sushi/Downloads/data-platform-dev/source/api-inventory.json' /tmp/cli-coverage.final.json
cmp docs/superpowers/specs/data-platform-cli-coverage-baseline.json /tmp/cli-coverage.final.json
git diff --check
```

预期：所有进程退出码均为 0，覆盖率字节级一致，且不存在密钥扫描发现。

- [ ] **步骤 7：追加证据并提交单阶段完成记录**

将每个引擎的完整命令计数、通过计数、版本、驱动哈希以及脱敏后的环境指纹追加到 `TEST.md`。

```bash
git add packages/data-platform-cli/tests/TEST.md packages/data-platform-cli/tests/fixtures skills/cli-anything-data-platform/SKILL.md
git commit -m "test(cli): pass API and four-engine database gates"
```

## 计划自审结果

- 所有实现工作均属于单一阶段；不存在独立的阶段性发布。
- API 指外部 API/模型/服务运行时，绝非 Data Platform Express。
- 每个业务命令均已分类，且复合命令会进入两个风险门禁。
- MySQL、PostgreSQL、Oracle 和 DM 各自都需要真实的集成证据。
- 涵盖了覆盖率、可靠性、所有业务模块、本体、aviation 验收、打包、Web 回归及前端构建。
- 不存在占位符；任务明确了文件、接口、失败观测、验证命令、预期结果及提交边界。
