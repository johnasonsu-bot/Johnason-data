# Johnason Data Platform CLI / Johnason 数据平台 CLI

[中文](#中文) | [English](#english)

## 中文

本仓库正在将 Johnason Data Platform 改造为可全局安装、可供人员、脚本与 Agent 直接使用的 CLI。当前交付范围包括 CLI 基础运行时，以及覆盖 596 个 API、84 个前端功能入口、共享核心拆分、API/数据库双阶段测试和航空本体端到端验收的设计与实施方案。

> 当前状态：共享核心、全部业务能力包和动态 CLI capability registry 已落到 `codex/data-platform-cli`。API/数据库双阶段的真实外部环境门禁，以及航空本体 Skill 的两次真实运行，仍需在具备 MySQL、PostgreSQL、Oracle、达梦和 Kafka 的验收环境中完成。

### 核心交付件

| 交付件 | 简体中文 | English |
|---|---|---|
| Data Platform 全平台 CLI 架构设计 | [中文设计文档](docs/superpowers/specs/2026-08-12-data-platform-cli-design.zh-CN.md) | [English design](docs/superpowers/specs/2026-08-12-data-platform-cli-design.en.md) |
| 共享核心打包与风险门禁实施方案 | [中文实施方案](docs/superpowers/plans/2026-08-12-shared-core-packaging-and-risk-gates.zh-CN.md) | [English plan](docs/superpowers/plans/2026-08-12-shared-core-packaging-and-risk-gates.en.md) |
| CLI 全量改造单阶段实施方案 | [中文实施方案](docs/superpowers/plans/2026-08-12-cli-single-stage.zh-CN.md) | [English plan](docs/superpowers/plans/2026-08-12-cli-single-stage.en.md) |

### 验收基线

- 所有 596 个 API 与 84 个前端功能入口均须映射到 CLI 能力，或有经评审的 `notApplicable` 说明。
- 业务命令按外部 API 调用与数据库访问分类；数据库门禁覆盖 MySQL、PostgreSQL、Oracle 和达梦。
- `build-aviation-ontology` 工作流必须仅通过已安装的 CLI 连续成功运行两次，并验证幂等性、证据链和禁止旁路约束。
- Web 与 CLI 复用同一共享核心，同时保持现有 Web API 行为、权限与项目隔离兼容。

## English

This repository is evolving Johnason Data Platform into a globally installable CLI for people, scripts, and Agents. The current delivery scope includes the CLI foundation plus the architecture and implementation plans covering 596 APIs, 84 frontend entry points, shared-core packaging, two-stage API/database testing, and end-to-end aviation ontology acceptance.

> Current status: the shared core, all business capability packages, and the dynamic CLI capability registry are implemented on `codex/data-platform-cli`. Live API/database gates and the two-run aviation-ontology acceptance still require an environment with MySQL, PostgreSQL, Oracle, Dameng, and Kafka.

### Core Deliverables

| Deliverable | 简体中文 | English |
|---|---|---|
| Full-Platform Data Platform CLI Architecture Design | [中文设计文档](docs/superpowers/specs/2026-08-12-data-platform-cli-design.zh-CN.md) | [English design](docs/superpowers/specs/2026-08-12-data-platform-cli-design.en.md) |
| Shared-Core Packaging and Risk-Gate Implementation Plan | [中文实施方案](docs/superpowers/plans/2026-08-12-shared-core-packaging-and-risk-gates.zh-CN.md) | [English plan](docs/superpowers/plans/2026-08-12-shared-core-packaging-and-risk-gates.en.md) |
| Single-Stage Full CLI Transformation Plan | [中文实施方案](docs/superpowers/plans/2026-08-12-cli-single-stage.zh-CN.md) | [English plan](docs/superpowers/plans/2026-08-12-cli-single-stage.en.md) |

### Acceptance Baseline

- All 596 APIs and 84 frontend entry points must map to CLI capabilities or have reviewed `notApplicable` justifications.
- Business commands are classified as external-API calls and/or database access; database gates cover MySQL, PostgreSQL, Oracle, and Dameng.
- The `build-aviation-ontology` workflow must succeed twice using only the installed CLI, proving idempotency, evidence-chain completeness, and bypass prevention.
- Web and CLI consume the same shared core while preserving current Web API behavior, permissions, and project isolation.
