# Schema Sync and Aviation Service Export Implementation Plan

> **For Codex:** Execute this plan task-by-task with test-driven development and verify runtime state before completion.

**Goal:** 修复 PostgreSQL 视图依赖场景下的错误类型变更，并发布航空本体全体对象数据服务。

**Architecture:** 前端和接入服务显式持久化目标表模式；元数据层对 PostgreSQL 类型做语义归一化并按差异维度生成 DDL。数据服务层复用现有 PostgreSQL 数据源，为全部 `sem_entity_*`、`sem_relation_*`、`sem_rule_*` 对象发布统一 SQL 服务和应用授权。

**Tech Stack:** React/TypeScript/Vitest、Node.js/Jest、Express、MySQL、PostgreSQL、Docker。

---

### Task 1: 固化目标表模式

**Files:**
- Create: `frontend/src/pages/data-ingestion-jobs/task-target-mode.ts`
- Create: `frontend/src/pages/data-ingestion-jobs/task-target-mode.test.ts`
- Modify: `frontend/src/pages/data-ingestion-jobs/TaskConfigPage.tsx`
- Modify: `backend/src/modules/ingestion-tasks/ingestion-task.service.js`
- Test: relevant backend ingestion tests

1. 先添加历史任务和显式模式的失败测试。
2. 实现前端推断：显式 `create` 才是新建，其余默认 `existing`。
3. 后端持久化规范化后的 `targetTableMode`。
4. 运行前后端定向测试。

### Task 2: PostgreSQL 类型语义比较与安全 DDL

**Files:**
- Modify: `backend/src/modules/data-sources/data-source.metadata.js`
- Modify: `backend/src/modules/data-sources/data-source.metadata.test.js`
- Modify: `backend/src/modules/ingestion-tasks/ingestion-task.service.js`
- Modify: related ingestion tests

1. 添加类型别名等价、仅可空性变化、仅默认值变化、`jsonb/timestamptz` 保真的失败测试。
2. 实现 PostgreSQL 类型归一化比较。
3. 将类型、可空性、默认值 DDL 分离，只生成实际需要的语句。
4. 运行定向测试与完整相关测试。

### Task 3: 运行态回归任务 137

1. 保存并执行航空数据接入任务 137。
2. 验证任务成功、`ods_flight_schedule` 数据存在且来源共存。
3. 验证依赖视图数量、定义和查询均未受损。

### Task 4: 发布航空本体全体对象数据服务

1. 从 PostgreSQL 枚举当前全部 `sem_entity_*`、`sem_relation_*`、`sem_rule_*` 对象。
2. 建立统一全体对象 SQL 数据服务，返回对象类型、对象名称及对象行 JSON。
3. 建立或复用航空本体服务应用，授权服务并发布。
4. 使用运行时 Token 请求服务，验证返回数据和分页。

### Task 5: 输出运行参数和最终验证

1. 确认 API URL、服务/任务稳定 ID、可连接的 CDP URL 和运行时 Token。
2. 执行前端构建、后端定向测试和运行态冒烟测试。
3. 复核 Git diff，排除运行时密钥与生成物。
4. 提交并同步 `dev` 到远端。

