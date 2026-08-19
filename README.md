# Johnason Data Platform CLI / Johnason 数据平台 CLI

[中文](#中文) | [English](#english)

## 中文

本仓库正在将 Johnason Data Platform 改造为可全局安装、可供人员、脚本与 Agent 直接使用的 CLI。当前交付范围包括 CLI 基础运行时，以及覆盖 596 个 API、84 个前端功能入口、共享核心拆分、API/数据库双阶段测试和航空本体端到端验收的设计与实施方案。

> 当前状态：共享 kernel、21 个业务模块、aggregate core 与 CLI 命令树已实现，596 个 API 与 84 个前端入口已映射。仓库内隔离安装、单元/合同/Web 回归已通过；真实外部 API、四种数据库、21 个历史版本回退及航空流程连续两次的最终证据尚未齐全，因此聚合发布状态仍为 `blocked`，不是 `accepted`。

本地验收安装固定在 `./.local/data-platform-cli`，执行 `npm run install:cli:local`。该流程不覆盖根 `node_modules`、不全局安装 CLI，也不影响现有开发服务。

本地构建与 CLI 验收命令：

```bash
npm run build                 # 生成模块运行时、边界扫描和 596/596 覆盖门禁
npm test                      # kernel、aggregate、CLI 和 backend 合同测试
npm run install:cli:local     # 24 个 tarball 的隔离安装与任意 cwd 健康检查
npm run acceptance:cli        # 已安装 CLI 的 570 命令 + 596 capability dispatch
```

`docs/cli/source/PROJECT_OPERATION_MANUAL.md`、`api-inventory.json` 与 `project-operation-knowledge-graph.html` 是验收输入；覆盖报告写入 `docs/operations/cli-coverage-verification.json`，CLI 服务调用报告写入 `docs/operations/cli-service-acceptance.json`。真实外部 API、Oracle/达梦实例、模块回退和航空双次运行仍需对应基础设施与脱敏证据，缺失时聚合状态保持 `blocked`。

完整的本地安装、构建、启动、登录、验收和停止流程已整理为 [data-platform-deployment skill](README/skills/data-platform-deployment/SKILL.md)。

CLI 架构、两份实施方案、Data Platform 三件套、机器映射和运行证据的统一入口见 [Data Platform CLI 项目文档索引](docs/cli/README.md)。

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

> Current status: the shared kernel, 21 business modules, aggregate core, and generated CLI tree are implemented, mapping all 596 APIs and 84 frontend entries. Isolated repository-local installation plus unit, contract, and Web regressions pass. Final aggregate status remains `blocked`, not `accepted`, until real external API/four-database evidence, all 21 historical-package rollback drills, and two installed-CLI aviation runs are complete.

Run `npm run install:cli:local` for the isolated acceptance install under `./.local/data-platform-cli`. It does not replace the root `node_modules`, install globally, or touch running development services.

Use `npm run build`, `npm test`, `npm run install:cli:local`, and `npm run acceptance:cli` for the local build and installed-CLI acceptance sequence. The three files under `docs/cli/source/` are hashed and checked as the acceptance inputs; aggregate release remains blocked until real external infrastructure, rollback, and aviation evidence is available.

The full local install, build, start, login, acceptance, and stop workflow is documented in the [data-platform-deployment skill](README/skills/data-platform-deployment/SKILL.md).

See the [Data Platform CLI documentation index](docs/cli/README.md) for the architecture, two implementation plans, the three source-of-truth Data Platform artifacts, machine mappings, and runtime evidence.

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
