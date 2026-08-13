> 语言：[简体中文](./2026-08-12-shared-core-packaging-and-risk-gates.zh-CN.md) | [English](./2026-08-12-shared-core-packaging-and-risk-gates.en.md)

# 数据平台共享核心打包与风险门禁实施方案

> **针对智能代理工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐项实施此方案。步骤使用复选框 (`- [ ]`) 语法进行跟踪。

**目标：** 使全局安装的 CLI 和 Web 后端使用相同的独立打包应用核心，将所有 21 个业务模块迁移至精确版本，并在验收前要求提供每个模块的风险、回退和重新升级证据。

**架构：** 一个 npm workspace 包含一个传输无关的内核、21 个独立版本的业务模块包、一个聚合核心包、现有的 Web 后端以及 CLI。Web 和 CLI 仅依赖于聚合核心；每个模块依赖于内核，并通过注册的能力端口进行跨模块边界通信。测试环境验收通过安装来自本地测试制品仓库的精确模块 tarball，执行针对前一个已验收包的真实回退，然后重新安装候选版本并验证幂等性。

**技术栈：** Node.js 22.20+, npm workspaces 和 lockfiles, CommonJS, Zod 3.24, MySQL2, pg, oracledb, dmdb/managed JDBC, KafkaJS, DataX, Node test runner, Verdaccio 6.9.2（绑定至 loopback 用于回退测试）。

## 全局约束

- 业务回退粒度为现有的 21 个业务模块之一。
- 模块迁移直接替换原有的 Service 实现；生产环境不设运行时 legacy/core 路由。
- 生产环境不设影子或金丝雀路径；渐进式升级、回退和重新升级仅在测试环境中进行。
- Web、CLI 和 daemon 依赖于 `@johnason/data-platform-core`；它们绝不导入其他包的 `src` 路径。
- 内核和模块包绝不导入 Express, Commander, `backend/src/app.js` 或 CLI keychain。
- 包版本必须是精确版本；验收清单中禁止使用 `latest`、caret、tilde、git URL、workspace link 和文件路径依赖。
- 只有在通过所有风险门禁、实际前包回退、数据验证和候选版本重新升级后，模块才会被验收。
- 每个模块的首次迁移将当前行为发布为精确版本 `0.1.0`（状态为 `legacy-accepted`），随后将共享核心实现发布为精确版本 `0.2.0`（状态为 `core-candidate`）；回退证据必须能够安装这两个真实的 tarball。
- 在事务开始或命令验收后，绝不对旧实现进行写操作重放。
- 数据库 Schema 使用 expand/contract 模式，并在整个回退窗口期内支持候选版本和前一个已验收的模块版本。
- 若模块声明了特定的执行目标，则必须具备真实的 MySQL、PostgreSQL、Oracle 和 DM；基础设施缺失将阻断验收。
- 密钥绝不进入配置、输出、证据、事件、fixtures、清单、lockfiles 或 Git。
- 使用 TDD，并在实现前观察每个新测试是否因预期原因失败。

---

## 文件结构

### Workspace 与内核

- `package.json`: `packages/*` 和 `backend` 的私有工作区根目录。
- `package-lock.json`: 单一的精确版本工作区依赖图。
- `packages/data-platform-core-kernel/package.json`: 可发布的内核元数据。
- `packages/data-platform-core-kernel/src/runtime/database-runtime.js`: Profile/请求作用域的数据库运行时。
- `packages/data-platform-core-kernel/src/runtime/execution-context.js`: Actor、项目、权限、事务、审计及清理的组合。
- `packages/data-platform-core-kernel/src/contracts/*`: 能力 (capability)、结果、错误、module 清单以及运行时端口 (runtime-port) 的 Schema。
- `packages/data-platform-core-kernel/src/registry/*`: 能力/module 注册及版本兼容性校验。
- `packages/data-platform-core-kernel/src/risk/*`: 证据 Schema、依赖边界扫描器及验收计算。

### 首批提取的模块与聚合

- `packages/data-platform-module-auth`: 身份验证与会话能力。
- `packages/data-platform-module-project-spaces`: 项目与成员资格能力。
- `packages/data-platform-core`: 聚合清单、能力目录、精确的 module 依赖及运行时工厂。
- `backend/src/modules/auth/*`: Web 控制器/路由/Schema，以及迁移期间向 auth 包提供的兼容性导出。
- `backend/src/modules/project-spaces/*`: Web 控制器/路由/Schema，以及迁移期间向 project 包提供的兼容性导出。

### 剩余的 module 包

- `packages/data-platform-module-asset-search`
- `packages/data-platform-module-data-development`
- `packages/data-platform-module-data-lab`
- `packages/data-platform-module-data-lab-sources`
- `packages/data-platform-module-data-map`
- `packages/data-platform-module-data-services`
- `packages/data-platform-module-data-source-research`
- `packages/data-platform-module-data-sources`
- `packages/data-platform-module-data-standards`
- `packages/data-platform-module-dev-ai-configs`
- `packages/data-platform-module-file-imports`
- `packages/data-platform-module-ingestion-ai-configs`
- `packages/data-platform-module-ingestion-tasks`
- `packages/data-platform-module-model-providers`
- `packages/data-platform-module-platform`
- `packages/data-platform-module-quality-control`
- `packages/data-platform-module-reporting`
- `packages/data-platform-module-system-knowledge-base`
- `packages/data-platform-module-system-management`

### 验收与回退工具链

- `scripts/check-core-package-boundaries.js`: 依赖方向、循环依赖、源码路径及传输导入检查。
- `scripts/build-module-acceptance-manifest.js`: 结合模块证据与 lockfile 完整性。
- `scripts/run-module-rollback-drill.js`: 停止目标 worker，安装旧版本并验证，重新升级 candidate 版本并验证幂等性。
- `tests/module-acceptance/fixtures/verdaccio.yaml`: 仅限回环地址、无需认证的临时制品仓库，其存储路径随测试创建且永不提交。
- `tests/shared-core-install/*`: 从 tarball 安装以及任意工作目录的测试。
- `tests/module-acceptance/`: 每个业务模块对应一个命名目录，包含 Web、CLI 一致性、执行目标、故障注入、schema 及回退测试的黄金标准。
- `evidence/module-acceptance/`: 按模块名称和精确版本分组生成的脱敏证据；仅提交经明确批准的证据。

---

### 任务 1: 建立工作区与可发布内核边界

**文件：**
- 创建: `package.json`
- 创建: `package-lock.json`
- 创建: `packages/data-platform-core-kernel/package.json`
- 创建: `packages/data-platform-core-kernel/src/index.js`
- 创建: `packages/data-platform-core-kernel/src/contracts/module-manifest.js`
- 创建: `packages/data-platform-core-kernel/tests/package-boundary.test.js`
- 修改: `backend/package.json`
- 修改: `packages/data-platform-cli/package.json`

**接口：**
- `validateModuleManifest(input) -> { moduleName, moduleVersion, capabilitySchemaVersion, capabilities }`。
- `moduleDefinition` 使用精确语义版本和不可变的 capability 元数据。
- 工作区包在开发期间进行解析，但模块验收阶段使用打包后的 tarball。

- [ ] **步骤 1: 编写失败的内核包测试**

```js
test("kernel is publishable and transport neutral", () => {
  const pkg = readPackage("packages/data-platform-core-kernel/package.json");
  assert.equal(pkg.name, "@johnason/data-platform-core-kernel");
  assert.equal(pkg.private, false);
  assert.deepEqual(pkg.files, ["src"]);
  assert.equal(pkg.engines.node, ">=22.20.0");
  assert.equal(pkg.dependencies?.express, undefined);
  assert.equal(pkg.dependencies?.commander, undefined);
});

test("module manifest rejects non-exact versions", () => {
  assert.throws(() => validateModuleManifest({
    moduleName: "auth",
    moduleVersion: "^0.1.0",
    capabilitySchemaVersion: "1.0.0",
    capabilities: [],
  }), /exact version/i);
});
```

- [ ] **步骤 2: 运行并验证预期失败**

运行: `node --test packages/data-platform-core-kernel/tests/package-boundary.test.js`

预期结果: FAIL，因为内核包和 manifest 校验器尚不存在。

- [ ] **步骤 3: 实现根工作区与严格的 manifest schema**

根包：

```json
{
  "name": "johnason-data-platform-workspace",
  "private": true,
  "workspaces": ["packages/*", "backend"],
  "engines": { "node": ">=22.20.0" },
  "scripts": {
    "test:core": "npm test --workspaces --if-present",
    "check:boundaries": "node scripts/check-core-package-boundaries.js"
  },
  "devDependencies": {
    "verdaccio": "6.9.2"
  }
}
```

Manifest Zod schema 仅接受 `/^\d+\.\d+\.\d+$/` 格式的版本、唯一的 capability ID 以及不可变的源码键/执行目标数组。

- [ ] **步骤 4: 运行工作区安装与测试**

运行：

```bash
npm install
node --test packages/data-platform-core-kernel/tests/package-boundary.test.js
npm --workspace @johnason/data-platform-core-kernel pack --dry-run
```

预期结果: PASS；tarball 仅包含内核 `src` 和包元数据。

- [ ] **步骤 5: 提交包边界定义**

```bash
git add package.json package-lock.json packages/data-platform-core-kernel backend/package.json packages/data-platform-cli/package.json
git commit -m "feat(core): establish publishable shared kernel"
```

### 任务 2: 强制执行依赖方向与独立安装

**文件：**
- 创建: `scripts/check-core-package-boundaries.js`
- 创建: `tests/shared-core-install/package-boundaries.test.js`
- 创建: `tests/shared-core-install/independent-install.test.js`
- 修改: `package.json`

**接口：**
- `scanPackageBoundaries(root) -> { violations, cycles, sourceImports }`。
- 违规代码: `TRANSPORT_IMPORT`, `SOURCE_PATH_IMPORT`, `REVERSE_DEPENDENCY`, `CYCLE`, `NON_EXACT_VERSION`。

- [ ] **步骤 1: 使用临时 fixture 包编写失败行为测试**

在测试运行时创建 fixtures，并断言以下情况均会产生精确的违规代码：kernel 导入 Express、CLI 导入 `../../backend/src`、模块 A 导入模块 B 的 `src`、kernel 到模块的依赖关系以及包循环依赖。有效的 Web/CLI → aggregate → modules → kernel 图谱应返回空数组。

- [ ] **第 2 步：运行并观察扫描器缺失导致的失败**

运行：`node --test tests/shared-core-install/package-boundaries.test.js`

预期：FAIL，因为缺少 `scanPackageBoundaries`。

- [ ] **第 3 步：实现 package.json 和 CommonJS 导入扫描**

通过包名解析内部包依赖，解析字面量 `require()` 目标，拒绝跨包的 `/src/` 导入，并执行深度优先循环检查。扫描器输出是确定性的，且仅包含相对于仓库的路径。

- [ 	] **第 4 步：测试仅 tarball 的安装**

将 kernel 打包到临时目录，在临时前缀下进行安装，从另一个 cwd 运行 `require("@johnason/data-platform-core-kernel")`，并断言测试进程未打开临时前缀之外的任何文件。

运行：`node --test tests/shared-core-install/*.test.js`

预期：PASS。

- [ ] **第 5 步：提交依赖强制执行**

```bash
git add scripts/check-core-package-boundaries.js tests/shared-core-install package.json
git commit -m "test(core): enforce package dependency boundaries"
```

### 任务 3: 将数据库运行时和执行契约移入 Kernel

**文件：**
- 创建：`packages/data-platform-core-kernel/src/runtime/database-runtime.js`
- 创建：`packages/data-platform-core-kernel/src/runtime/execution-context.js`
- 创建：`packages/data-platform-core-kernel/src/contracts/errors.js`
- 创建：`packages/data-platform-core-kernel/tests/database-runtime.test.js`
- 创建：`packages/data-platform-cli/src/runtime/database.js`
- 创建：`packages/data-platform-cli/tests/database-runtime.test.js`
- 修改：`backend/src/config/database.js`

**接口：**
- `createDatabaseRuntime(config, mysqlImpl) -> { pool, testConnection, close }`。
- `runWithDatabaseRuntime(runtime, callback) -> Promise<T>`。
- `getDatabaseRuntime() -> runtime`；若无活动/默认运行时则抛出 `DATABASE_RUNTIME_MISSING`。
- `runWithExecutionContext(context, callback) -> Promise<T>`。
- CLI `createProfileDatabaseRuntime(profile, keychain, mysqlImpl) -> runtime`。

- [ ] **第 1 步：编写失败的并发隔离和清理测试**

测试两个并发的 `AsyncLocalStorage` 回调（使用连接池 `a` 和 `b`）；嵌套调用必须分别返回 `a` 和 `b`。测试成功与失败后恰好执行一次 `close()`、默认 Web 运行时兼容性、运行时缺失导致的失败，以及 CLI 仅通过 keychain 获取密码。

- [ ] **第 2 步：运行并验证失败**

运行：

```bash
node --test packages/data-platform-core-kernel/tests/database-runtime.test.js packages/data-platform-cli/tests/database-runtime.test.js
```

预期：FAIL，提示缺少运行时模块。

- [ ] **第 3 步：实现运行时和 Web 兼容性导出**

Kernel 拥有 `AsyncLocalStorage`。`backend/src/config/database.js` 创建一个 Web 运行时并继续导出 `{ pool, testConnection }`，以确保未迁移的模块保持原有行为。CLI 从非敏感的 profile 字段结合 keychain 密码创建一个连接池，且永不持久化组合后的配置。

- [ ] **第 4 步：运行针对性、CLI 和 backend 回归测试**

```bash
node --test packages/data-platform-core-kernel/tests/database-runtime.test.js packages/data-platform-cli/tests/database-runtime.test.js
cd backend && npm test
```

预期：所有针对性测试和 backend 测试套件均通过。

- [ ] **步骤 5：提交运行时提取**

```bash
git add packages/data-platform-core-kernel/src/runtime packages/data-platform-core-kernel/src/contracts packages/data-platform-core-kernel/tests packages/data-platform-cli/src/runtime/database.js packages/data-platform-cli/tests/database-runtime.test.js backend/src/config/database.js
git commit -m "refactor(core): share profile scoped database runtime"
```

### 任务 4: 提取并封装身份验证

**文件：**
- 创建：`packages/data-platform-module-auth/package.json`
- 创建：`packages/data-platform-module-auth/src/auth.repository.js`
- 创建：`packages/data-platform-module-auth/src/auth-session.repository.js`
- 创建：`packages/data-platform-module-auth/src/auth.service.js`
- 创建：`packages/data-platform-module-auth/src/session-policy.js`
- 创建：`packages/data-platform-module-auth/src/index.js`
- 创建：`packages/data-platform-module-auth/tests/auth.contract.test.js`
- 修改：`backend/src/modules/auth/auth.repository.js`
- 修改：`backend/src/modules/auth/auth-session.repository.js`
- 修改：`backend/src/modules/auth/auth.service.js`
- 修改：`backend/src/modules/auth/auth.controller.js`

**接口：**
- 模块导出 `moduleManifest`、`createAuthCapabilities(dependencies)` 以及兼容性 service/repository 工厂。
- 能力集 (Capabilities)：`auth.login`、`auth.profile`、`auth.logout`。
- 依赖项包括 `databaseRuntime`、`jwtCodec`、`passwordHasher`、`clock` 和 `idGenerator`。

- [ ] **步骤 1: 发布身份验证 legacy 基准并捕获其契约**

将当前的传输无关 (transport-neutral) 身份验证行为封装为 `@johnason/data-platform-module-auth@0.1.0`；仅将 repository-global 依赖替换为显式的 legacy 适配器端口。将 tarball 发布到 loopback 测试制品仓库，并在现有 backend 测试套件和 golden fixtures 通过后将其标记为 `legacy-accepted`。Golden fixtures 覆盖了登录成功、密码错误、用户禁用、会话撤销、登出、事务回退、token/用户不匹配、响应 DTO 以及密钥脱敏。将包版本更改为 `0.2.0`，然后编写一个测试，调用预期的共享核心 (shared-core) 能力，并将其领域结果与 `0.1.0` 的 golden 基准进行比较。

- [ ] **步骤 2: 运行并观察 module-not-found 失败情况**

运行：`node --test packages/data-platform-module-auth/tests/auth.contract.test.js`

预期：失败 (FAIL)，因为 `0.2.0` 尚未暴露传输无关 (transport-neutral) 的能力工厂。

- [ ] **步骤 3: 迁移传输无关 (transport-neutral) 身份验证代码并注入依赖**

Repositories 调用 `getDatabaseRuntime().pool`；service 不再导入 `config/env` 或全局 pool。JWT 密钥/过期时间仍保持为 Web/CLI 运行时配置，并通过 `jwtCodec` 传入。现有的 backend 文件重新导出 `0.2.0` 包的入口点，而 routes/controllers 保留 HTTP 转换逻辑。保持已发布的 `0.1.0` tarball 不变，以便进行回退 (rollback)。

- [ ] **步骤 4: 验证包、Web 兼容性以及是否存在传输层导入**

```bash
node --test packages/data-platform-module-auth/tests/auth.contract.test.js
node scripts/check-core-package-boundaries.js
cd backend && npm test
```

预期：通过 (PASS)；auth 包不存在 Express/Commander/source-path 违规。

- [ ] **步骤 5: 提交 auth 模块**

```bash
git add packages/data-platform-module-auth backend/src/modules/auth
git commit -m "refactor(core): package authentication capabilities"
```

### 任务 5: 提取并封装项目上下文与访问策略

**文件：**
- 新增：`packages/data-platform-module-project-spaces/package.json`
- 新增：`packages/data-platform-module-project-spaces/src/project-space.repository.js`
- 新增：`packages/data-platform-module-project-spaces/src/project-space.service.js`
- 新增：`packages/data-platform-module-project-spaces/src/project-policy.js`
- 新增：`packages/data-platform-module-project-spaces/src/index.js`
- 新增：`packages/data-platform-module-project-spaces/tests/project.contract.test.js`
- 新增：`packages/data-platform-core-kernel/src/runtime/authorization-policy.js`
- 新增：`packages/data-platform-core-kernel/src/runtime/license-policy.js`
- 新增：`packages/data-platform-core-kernel/src/runtime/activation-policy.js`
- 修改：`backend/src/modules/project-spaces/project-space.repository.js`
- 修改：`backend/src/modules/project-spaces/project-space.service.js`
- 修改：`backend/src/common/middleware/auth.js`
- 修改：`backend/src/common/middleware/license-feature.js`
- 修改：`backend/src/common/middleware/activation.js`

**接口：**
- `authorizeCapability(actor, { modules, action, readOnlyAllowed })`。
- `resolveProject(actor, requestedProjectId, projectService) -> { project, member }`。
- 模块能力覆盖项目列表/当前/解析/使用/访问检查，并从覆盖基线中获取 API keys。

- [ ] **步骤 1：发布项目 legacy 基线并编写失败的 candidate 测试**

将当前的传输无关项目行为封装为 `@johnason/data-platform-module-project-spaces@0.1.0`，发布至 loopback 制品仓库，并在 Web golden 测试通过后将其标记为 `legacy-accepted`。将包版本更改为 `0.2.0`，并编写失败的 candidate 测试，覆盖管理员、查看者写入拒绝、模块权限拒绝、成员缺失、项目禁用、并发项目上下文、默认项目选择、零/多个解析结果以及 Web 响应的精确兼容性。

- [ ] **步骤 2：运行并验证预期失败**

运行：

```bash
node --test packages/data-platform-module-project-spaces/tests/project.contract.test.js packages/data-platform-core-kernel/tests/execution-context.test.js
```

预期：FAIL，因为缺少封装的项目策略。

- [ ] **步骤 3：实现策略并适配 Web 中间件**

Controller/middleware 仅负责 HTTP 输入/输出的转换。Kernel 错误应包含稳定的 `code`、`statusCode`、`retryable` 以及脱敏详情。保留 `req.user`、`req.project`、`req.projectId` 和 `req.projectMember`。

- [ ] **步骤 4：运行契约测试、边界扫描及 Web 测试**

```bash
node --test packages/data-platform-module-project-spaces/tests/project.contract.test.js packages/data-platform-core-kernel/tests/*.test.js
node scripts/check-core-package-boundaries.js
cd backend && npm test
```

预期：PASS。

- [ ] **步骤 5：提交项目与策略提取**

```bash
git add packages/data-platform-module-project-spaces packages/data-platform-core-kernel/src/runtime backend/src/modules/project-spaces backend/src/common/middleware
git commit -m "refactor(core): package project and access policies"
```

### 任务 6：构建聚合核心并将 Web/CLI 绑定至封装包

**文件：**
- 新增：`packages/data-platform-core/package.json`
- 新增：`packages/data-platform-core/src/module-manifest.json`
- 新增：`packages/data-platform-core/src/catalog.js`
- 新增：`packages/data-platform-core/src/runtime.js`
- 新增：`packages/data-platform-core/tests/catalog.test.js`
- 修改：`backend/package.json`
- 修改：`packages/data-platform-cli/package.json`
- 修改：`packages/data-platform-cli/src/main.js`
- 新增：`tests/shared-core-install/aggregate-install.test.js`

**接口：**
- `createDataPlatformCore(runtimeDependencies) -> { catalog, execute, moduleVersions }`。
- `catalog.get(capabilityId)` 返回且仅返回一个定义。
- `execute(capabilityId, input, context)` 校验 schema 并调用所选的 module 能力。

- [ ] **步骤 1：编写失败的聚合唯一性与版本测试**

拒绝重复的 capability ID、无别名的重复 source API key、manifest/lock/export 版本不匹配、不兼容的 capability schema 以及缺失的必要 module。断言 auth/project 能力能够从任意 cwd 下已安装的 aggregate tarball 中执行。

- [ ] **步骤 2：运行并观察聚合缺失导致的失败**

运行：`node --test packages/data-platform-core/tests/catalog.test.js tests/shared-core-install/aggregate-install.test.js`

预期：失败，因为 aggregate 包不存在。

- [ ] **步骤 3：实现 aggregate catalog 与精确版本依赖**

初始 aggregate 包含 auth/project 的 `0.2.0` core-candidate，并记录其 `0.1.0` rollback 版本；后续每个 module 任务都会更新 manifest 和 exact version 依赖。CLI 从 profile/keychain 构建 runtime dependencies。Web 在不导入 CLI 的情况下从 environment/config 构建 runtime dependencies。

- [ ] **步骤 4：打包并安装 kernel、modules、aggregate 及 CLI**

使用可丢弃的本地 npm registry；发布带版本的 tarballs，在新的 prefix 下安装 CLI，从另一个 cwd 运行，并断言加载过程绝不会打开 repository 路径或启动 Express listener。

- [ ] **步骤 5：提交 aggregate 与消费者绑定**

```bash
git add packages/data-platform-core backend/package.json packages/data-platform-cli tests/shared-core-install
git commit -m "feat(core): aggregate shared capabilities for web and CLI"
```

### 任务 7：实现风险证据与验收计算

**文件：**
- 创建：`packages/data-platform-core-kernel/src/risk/evidence-schema.js`
- 创建：`packages/data-platform-core-kernel/src/risk/acceptance.js`
- 创建：`packages/data-platform-core-kernel/tests/risk-acceptance.test.js`
- 创建：`scripts/build-module-acceptance-manifest.js`
- 创建：`tests/module-acceptance/evidence.test.js`

**接口：**
- 风险门禁 (Risk gates)：`dependencyBoundary`, `runtimeIsolation`, `transaction`, `webCompatibility`, `cliParity`, `executionTargets`, `faultInjection`, `packageInstall`, `schemaCompatibility`, `rollbackDrill`, `reUpgradeIdempotency`。
- `evaluateModuleEvidence(evidence) -> { accepted, status, failures }`。
- 状态 (Status)：`legacy-accepted`, `core-candidate`, `testing`, `rollback-drill`, `re-upgrade`, `accepted`, `blocked`, `failed`。

- [ ] **步骤 1：编写失败的严格证据测试**

仅接受全 `passed`、零失败、零 secret 的证据。拒绝跳过的门禁、未知的门禁、模拟的 Oracle/DM 证据、缺失的 package 完整性、版本不匹配、时间戳逆序、明文格式的 secret 字段，以及计算结果为 false 时 `accepted:true` 的情况。

- [ ] **步骤 2：运行并观察评估器缺失导致的失败**

运行：`node --test packages/data-platform-core-kernel/tests/risk-acceptance.test.js tests/module-acceptance/evidence.test.js`

预期：失败，因为证据 schema/评估器不存在。

- [ ] **步骤 3：实现证据归一化与 manifest 构建器**

证据存储命令、版本、脱敏后的环境指纹、计数、耗时以及制品哈希。验收结果通过计算得出，绝不信任输入值。Builder 在输出聚合验收结果前，会验证 lockfile 的完整性及已安装包的导出内容。

- [ ] **步骤 4：运行证据与密钥扫描**

运行：

```bash
node --test packages/data-platform-core-kernel/tests/risk-acceptance.test.js tests/module-acceptance/evidence.test.js
node scripts/build-module-acceptance-manifest.js --verify-only
```

预期：PASS；在回退证据存在之前，不应有已验收的模块。

- [ ] **步骤 5：提交证据门禁**

```bash
git add packages/data-platform-core-kernel/src/risk packages/data-platform-core-kernel/tests/risk-acceptance.test.js scripts/build-module-acceptance-manifest.js tests/module-acceptance
git commit -m "feat(core): enforce module risk acceptance evidence"
```

### 任务 8：实现真实的包回退与重新升级演练

**文件：**
- 创建：`scripts/run-module-rollback-drill.js`
- 创建：`tests/module-acceptance/rollback-drill.test.js`
- 创建：`tests/module-acceptance/fixtures/test-module-v1/package.json`
- 创建：`tests/module-acceptance/fixtures/test-module-v1/index.js`
- 创建：`tests/module-acceptance/fixtures/test-module-v2/package.json`
- 创建：`tests/module-acceptance/fixtures/test-module-v2/index.js`
- 创建：`tests/module-acceptance/fixtures/verdaccio.yaml`
- 创建：`docs/operations/module-rollback-runbook.md`

**接口：**
- `runRollbackDrill({ moduleName, candidateVersion, rollbackVersion, registryUrl, commands, evidenceDir })`。
- 退出码：`0 accepted`、`7 infrastructure blocked`、`1 validation/rollback/re-upgrade failure`。

- [ ] **步骤 1：编写失败的 disposable-registry 回退测试**

在操作系统分配的 loopback 端口上启动带有临时存储的 Verdaccio 6.9.2。发布 fixture `0.1.0` 和 `0.2.0`；安装 `0.2.0`，创建业务事实，停止目标 worker hooks，安装 `0.1.0`，证明其他包版本在字节层面完全一致，验证 `0.1.0` 能读取升级后的 schema/facts，重新安装 `0.2.0`，使用相同的幂等键再次运行，并断言不存在重复事实。测试回退失败时是否保留维护状态。

- [ ] **步骤 2：运行并观察编排器缺失导致的失败**

运行：`node --test tests/module-acceptance/rollback-drill.test.js`

预期：FAIL，因为回退演练不存在。

- [ ] **步骤 3：实现 stop/drain/snapshot/install/verify/re-upgrade 序列**

该脚本会拒绝生产环境、非 loopback 测试制品仓库、脏清单、非精确版本、降级迁移以及包含内联密钥的命令。它通过测试拥有的子进程启动/停止 disposable registry，原子化地写入脱敏证据，且绝不会从制品仓库中删除包版本。

- [ ] **步骤 4：运行回退测试与故障注入**

运行：`node --test tests/module-acceptance/rollback-drill.test.js`

预期：成功路径与注入的失败路径均应 PASS。

- [ ] **步骤 5：提交回退工具链**

```bash
git add scripts/run-module-rollback-drill.js tests/module-acceptance docs/operations/module-rollback-runbook.md
git commit -m "test(core): prove module rollback and re-upgrade"
```

### 任务 9：迁移剩余的 19 个业务模块

**文件：**
- 创建：文件结构中列出的剩余 19 个 `packages/data-platform-module-*` 目录。
- 创建：下方迁移矩阵中列出的 19 个精确的 `tests/module-acceptance/*/module.contract.test.js` 文件。
- 修改：下方列出的 19 个精确后端目录下的 controller、Service、Repository 和 adapter 文件；在调用方迁移后，旧的 Service/Repository/adapter 入口文件将变为兼容性导出。
- 修改：`packages/data-platform-core/package.json`。
- 修改：`packages/data-platform-core/src/module-manifest.json`。

**接口：**
- 每个 module 导出 `{ moduleManifest, createCapabilities, createRuntimeAdapters }`。
- 每个 capability 导出 `(input, executionContext) -> Promise<ResultDTO>`，并包含 `sourceApiKeys`、`sourceFrontendKeys`、schemas、权限元数据、mutation 元数据以及 `executionTargets`。

**迁移矩阵与固定顺序：**

| 顺序 | 后端目录 | 模块包 | 验收测试 | API keys |
|---:|---|---|---|---:|
| 1 | `backend/src/modules/platform` | `packages/data-platform-module-platform` | `tests/module-acceptance/platform/module.contract.test.js` | 7 |
| 2 | `backend/src/modules/asset-search` | `packages/data-platform-module-asset-search` | `tests/module-acceptance/asset-search/module.contract.test.js` | 8 |
| 3 | `backend/src/modules/data-sources` | `packages/data-platform-module-data-sources` | `tests/module-acceptance/data-sources/module.contract.test.js` | 9 |
| 4 | `backend/src/modules/data-source-research` | `packages/data-platform-module-data-source-research` | `tests/module-acceptance/data-source-research/module.contract.test.js` | 18 |
| 5 | `backend/src/modules/data-lab-sources` | `packages/data-platform-module-data-lab-sources` | `tests/module-acceptance/data-lab-sources/module.contract.test.js` | 9 |
| 6 | `backend/src/modules/ingestion-ai-configs` | `packages/data-platform-module-ingestion-ai-configs` | `tests/module-acceptance/ingestion-ai-configs/module.contract.test.js` | 2 |
| 7 | `backend/src/modules/ingestion-tasks` | `packages/data-platform-module-ingestion-tasks` | `tests/module-acceptance/ingestion-tasks/module.contract.test.js` | 14 |
| 8 | `backend/src/modules/file-imports` | `packages/data-platform-module-file-imports` | `tests/module-acceptance/file-imports/module.contract.test.js` | 11 |
| 9 | `backend/src/modules/model-providers` | `packages/data-platform-module-model-providers` | `tests/module-acceptance/model-providers/module.contract.test.js` | 5 |
| 10 | `backend/src/modules/dev-ai-configs` | `packages/data-platform-module-dev-ai-configs` | `tests/module-acceptance/dev-ai-configs/module.contract.test.js` | 2 |
| 11 | `backend/src/modules/data-standards` | `packages/data-platform-module-data-standards` | `tests/module-acceptance/data-standards/module.contract.test.js` | 31 |
| 12 | `backend/src/modules/data-map` | `packages/data-platform-module-data-map` | `tests/module-acceptance/data-map/module.contract.test.js` | 41 |
| 13 | `backend/src/modules/data-development` | `packages/data-platform-module-data-development` | `tests/module-acceptance/data-development/module.contract.test.js` | 82 |
| 14 | `backend/src/modules/data-lab` | `packages/data-platform-module-data-lab` | `tests/module-acceptance/data-lab/module.contract.test.js` | 135 |
| 15 | `backend/src/modules/quality-control` | `packages/data-platform-module-quality-control` | `tests/module-acceptance/quality-control/module.contract.test.js` | 87 |
| 16 | `backend/src/modules/data-services` | `packages/data-platform-module-data-services` | `tests/module-acceptance/data-services/module.contract.test.js` | 32 |
| 17 | `backend/src/modules/reporting` | `packages/data-platform-module-reporting` | `tests/module-acceptance/reporting/module.contract.test.js` | 43 |
| 18 | `backend/src/modules/system-knowledge-base` | `packages/data-platform-module-system-knowledge-base` | `tests/module-acceptance/system-knowledge-base/module.contract.test.js` | 12 |
| 19 | `backend/src/modules/system-management` | `packages/data-platform-module-system-management` | `tests/module-acceptance/system-management/module.contract.test.js` | 27 |

Matrix API 数量（auth (4) 加 project-spaces (17)）共计 596。Platform 负责 `health`、`platform` 和 `platform-runtime`；data-services 负责 `data-services` 和 `service-runtime`；data-lab 负责 `data-modeling`；reporting 负责 `reporting` 和 `reporting-ai-configs`。

- [ ] **步骤 1：为每个模块编写失败的源码覆盖率与 golden-contract 测试**

针对固定矩阵中的下一行，加载 596/84 基准线，并断言其在矩阵中的精确 API-key 数量。在更改行为之前，将传输无关的当前实现复制到模块包中，仅将 repository-global 依赖替换为显式的 legacy adapter 端口，设置版本为 `0.1.0`，将 tarball 发布到 loopback 测试制品仓库，运行 golden 基准线，并记录 `legacy-accepted`。随后设置版本为 `0.2.0`，并为 shared-core candidate 编写失败的能力契约。捕获该模块相关的现有 Web 行为，包括成功、校验、权限、未找到、冲突、文件/流、事务回退以及依赖失败。

- [ ] **步骤 2：运行每个模块的测试并观察缺失的能力失败情况**

针对 candidate 版本 `0.2.0`，运行当前矩阵行中的精确验收测试路径。

预期结果：FAIL，并列出该模块未映射的源码键。

- [ ] **步骤 3：移动 Service/Repository/adapter 并绑定 Controller/core 目录**

移动传输无关的代码，注入运行时端口，将 HTTP 上下文替换为经批准的调用上下文，在 Controller 中保留 Web 响应转换，并更新聚合后的精确模块版本。仅在所有调用方完成迁移前，将旧后端文件路径作为兼容性 re-exports 保留。

- [ ] **步骤 4：针对该模块运行所有风险门禁及回退演练**

针对当前矩阵行运行其精确验收测试；运行 `node scripts/check-core-package-boundaries.js`；运行 `node scripts/run-module-rollback-drill.js`，使用精确的 candidate 版本 `0.2.0` 和 rollback 版本 `0.1.0`；最后运行 `cd backend && npm test`。

预期结果：通过 11 项风险门禁，通过回退/重新升级测试，通过 Web 回归测试，发现严重问题为 0。

- [ ] **步骤 5：逐个提交模块**

仅暂存当前矩阵行的模块包、backend 目录、验收目录、聚合清单及 lockfile。使用 `refactor(core): package <moduleName> capabilities` 进行提交，其中 `moduleName` 从经过验证的 candidate 包清单中原样读取。

为所有 19 个模块重复任务 9 的步骤 1–5。若某个模块失败，其清单将保留在之前的已验收版本上；其他独立模块可以继续，但全阶段验收仍视为未完成。

### 任务 10: 执行聚合 API、四数据库、航空及回退验收

**文件：**
- 新建：`tests/module-acceptance/aggregate/aggregate-acceptance.test.js`
- 修改：`packages/data-platform-cli/tests/api-gate.test.js`
- 修改：`packages/data-platform-cli/tests/database-gate.test.js`
- 修改：`packages/data-platform-cli/tests/aviation-acceptance.test.js`
- 新建：`evidence/module-acceptance/aggregate/manifest.json`
- 修改：`packages/data-platform-cli/tests/TEST.md`

**接口：**
- Aggregate 验收需包含确切的 21 个 module 证据文档以及 596/84 覆盖基准。
- 发布结果为 `accepted`、`blocked` 或 `failed`；部分验收不能标记为完成。

- [ ] **步骤 1：编写失败的 aggregate gate**

要求 21 个已验收的 modules，精确的 manifest/lock/export 版本，596/596 APIs，84/84 frontend entries，零未分类命令，API gate 证据，MySQL/PG/Oracle/DM 证据，两次 aviation 运行，零重复事实，零 secrets，以及独立的已打包 CLI 安装。

- [ ] **步骤 2：运行并观察不完整的 module 证据失败情况**

运行：`node --test tests/module-acceptance/aggregate/aggregate-acceptance.test.js`

预期：FAIL，列出所有缺失或未被接受的 module/evidence gate。

- [ ] **步骤 3：使用已打包的 aggregate 执行外部 API gate**

运行：`CLI_API_GATE=1 node --test packages/data-platform-cli/tests/api-gate.test.js`

预期：测试所有 API 分类的能力；bypass 为 0；secret 发现为 0。

- [ ] **步骤 4：执行全部四个真实数据库 gate**

针对 `mysql`、`postgresql`、`oracle` 和 `dm` 各运行一次，并设置 `CLI_DATABASE_GATE=1`。测试框架拒绝使用 mocks，并记录真实的数据库/驱动指纹。任何不可用的引擎均产生 `blocked` 而非 `passed`。

- [ ] **步骤 5：运行两次 aviation 验收及全部 21 次 rollback 演练**

已安装的 CLI 运行两次经批准的 aviation 工作流。随后针对最终的 candidate aggregate 执行每个 module 的 rollback 和 re-upgrade 演练。预期：无重复业务键，无违规 bypass，且所有 modules 均返回其 candidate accepted 版本。

- [ ] **步骤 6：运行最终回归、打包、边界及证据验证**

```bash
npm test --workspaces --if-present
npm run check:boundaries
cd backend && npm test
cd ../frontend && npm run build
cd ../packages/data-platform-cli && npm test && npm run pack:check
cd ../..
node scripts/build-module-acceptance-manifest.js --verify-only
node --test tests/module-acceptance/aggregate/aggregate-acceptance.test.js
git diff --check
```

预期：所有命令退出码为 0，21 个 modules 已验收，且 aggregate 证据中无 secret 发现。

- [ ] **步骤 7：提交 aggregate 验收证据**

```bash
git add evidence/module-acceptance/aggregate packages/data-platform-cli/tests/TEST.md
git commit -m "test(core): accept shared core with module rollback evidence"
```

## 方案自审结果

- 包边界缺口在数据库运行时或业务提取之前已解决：已安装的 CLI 使用打包好的 core/module 包，而非后端源码。
- 所有 21 个现有业务 modules 均具有精确的 module 包映射和独立的 rollback 边界。
- 所有 14 项设计风险均映射到 11 个机器可读 risk gates 中的一个或多个；针对 driver/DataX/API/secret 的特定检查包含在 `executionTargets`、`faultInjection`、`packageInstall` 和 `schemaCompatibility` 证据中。
- 明确了 Direct Service 替换、仅限测试的渐进式升级、无生产环境 canary、无运行时 legacy router 以及无 write replay。
- Rollback 在升级后的 schema 上验证真实的 `0.1.0 legacy-accepted` 包；该 schema 由 `0.2.0` 升级，同时保持其他 module 版本不变，并要求 `0.2.0` re-upgrade 具备幂等性。
- 类型名称与证据 gate 名称与批准的设计保持一致。
- 不存在任何实现占位符；module 重复使用固定的 19 行矩阵，包含精确的目录、包路径、测试、覆盖率计数、顺序，且每行对应一个经过独立评审的 commit。
