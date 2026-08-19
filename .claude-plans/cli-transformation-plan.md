# Data Platform CLI 全量改造实施计划

## 计划元数据

- **开始时间**: 2026-08-13
- **分支**: data-platform-cli
- **目标**: 按照架构设计和实施方案完成CLI改造
- **验收标准**: 596 APIs + 84 前端入口全覆盖，通过API和4数据库门禁

## 项目现状分析

### 已有资产
1. **后端代码** (backend/src)
   - 23个业务模块完整实现
   - 596条API路由 (api-inventory.json已确认)
   - 84个前端功能入口
   - MySQL连接池、DataX、Kafka等基础设施

2. **CLI基础** (packages/data-platform-cli)
   - package.json配置完整
   - 基础运行时：paths.js, profile-store.js, keychain.js
   - main.js为空壳，待实现

3. **设计文档**
   - 架构设计: docs/superpowers/specs/2026-08-12-data-platform-cli-design.zh-CN.md
   - 共享核心方案: 2026-08-12-shared-core-packaging-and-risk-gates.zh-CN.md
   - 单阶段实施方案: 2026-08-12-cli-single-stage.zh-CN.md
   - 覆盖基线: data-platform-cli-coverage-baseline.json (596 APIs mapped)

### 差距识别
- [ ] 缺少workspace配置
- [ ] 缺少kernel包
- [ ] 缺少21个模块包
- [ ] 缺少aggregate core包
- [ ] 缺少完整命令树
- [ ] 缺少数据库适配器
- [ ] 缺少daemon实现
- [ ] 缺少ontology工具

## 实施策略

### 阶段划分
遵循方案的依赖顺序，分7个主要阶段：

1. **基础运行时** (Foundation)
2. **核心模块** (Core Modules - auth & projects)
3. **聚合核心** (Aggregate Core)
4. **业务模块迁移** (19 Business Modules)
5. **命令树生成** (CLI Command Tree)
6. **数据库适配器** (4-Engine Database Adapters)
7. **验收测试** (API & Database Gates)
