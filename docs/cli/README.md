# Data Platform CLI 项目文档索引

本索引聚焦 Data Platform CLI 全量改造、Data Platform 三件套、构建部署和验收证据。项目总览仍以仓库根目录 [README.md](../../README.md) 为入口。

## 推荐阅读顺序

1. 阅读 [CLI 架构设计](../superpowers/specs/2026-08-12-data-platform-cli-design.zh-CN.md)，确认共享核心、命令边界、权限、项目隔离、审计和数据库门禁约束。
2. 阅读 [共享核心打包与风险门禁实施方案](../superpowers/plans/2026-08-12-shared-core-packaging-and-risk-gates.zh-CN.md)，理解 21 个业务模块、精确版本、回退与重新升级要求。
3. 阅读 [CLI 全量转换单阶段实施方案](../superpowers/plans/2026-08-12-cli-single-stage.zh-CN.md)，理解 596 个 API、84 个前端入口、外部 API 和四类数据库的完成条件。
4. 使用下方 Data Platform 三件套作为 CLI 覆盖与服务调用的验收输入。
5. 读取机器映射和 `docs/operations/` 下的最新证据，不以文档描述替代实际验收结果。

## Data Platform 三件套

三件套是本次 CLI 改造的受控验收输入，位于 `docs/cli/source/`：

| 文件 | 作用 | 当前 SHA-256 |
|---|---|---|
| [PROJECT_OPERATION_MANUAL.md](source/PROJECT_OPERATION_MANUAL.md) | 项目操作、权限、项目上下文、业务模块和调用语义的人员可读基线 | `619cf9c139ebd49788acd8a1a7440d5d8574cb9034b4bb7e13de1a14ca8db350` |
| [api-inventory.json](source/api-inventory.json) | 596 个 API 的机器可读清单，是 CLI capability 覆盖核对的主输入 | `6cd896d1e38fb54ebd8317842eb618c4a28ede4eecf5e09f5bfb16374d696d0f` |
| [project-operation-knowledge-graph.html](source/project-operation-knowledge-graph.html) | 项目操作、模块、接口和前端入口关系的可交互知识图谱 | `1fa8acde4615bc6bed8af23ad277fde1089643781bbb1414dd45d5302c03468f` |

三件套的验收链路为：`三件套输入 -> coverage baseline / handler bindings -> 已安装 CLI dispatch -> docs/operations 运行证据`。三件套内容变化时，必须同步更新映射、验收证据和本表哈希。

## 架构与实施方案

| 类别 | 中文主文档 | 英文版本 | 用途 |
|---|---|---|---|
| 架构设计 | [Data Platform CLI 架构设计](../superpowers/specs/2026-08-12-data-platform-cli-design.zh-CN.md) | [English](../superpowers/specs/2026-08-12-data-platform-cli-design.en.md) | 定义 CLI 不经 Express、Web/CLI 共享核心、命令模型、可靠性和验收边界 |
| 实施方案一 | [共享核心打包与风险门禁](../superpowers/plans/2026-08-12-shared-core-packaging-and-risk-gates.zh-CN.md) | [English](../superpowers/plans/2026-08-12-shared-core-packaging-and-risk-gates.en.md) | 定义 21 模块打包、版本、回退、重新升级和数据库证据 |
| 实施方案二 | [CLI 全量转换单阶段方案](../superpowers/plans/2026-08-12-cli-single-stage.zh-CN.md) | [English](../superpowers/plans/2026-08-12-cli-single-stage.en.md) | 定义 596 API、84 前端入口、命令实现和两阶段风险门禁 |

辅助路线图与前置方案：

- [CLI 单阶段交付路线图](../superpowers/plans/2026-08-12-data-platform-cli-roadmap.md)
- [CLI Foundation 实施方案](../superpowers/plans/2026-08-12-cli-foundation.md)
- [共享核心风险门禁与回退设计](../superpowers/specs/2026-08-12-shared-core-risk-gates-and-rollback-design.md)

## 机器契约与映射

| 文件 | 用途 |
|---|---|
| [data-platform-cli-coverage-baseline.json](../superpowers/specs/data-platform-cli-coverage-baseline.json) | 固化 API、前端入口及覆盖指纹 |
| [data-platform-cli-handler-bindings.json](../superpowers/specs/data-platform-cli-handler-bindings.json) | 将 capability 绑定到共享核心处理器、权限和执行目标 |
| [aviation-ontology-cli-acceptance.json](../superpowers/specs/aviation-ontology-cli-acceptance.json) | 航空本体 CLI 验收契约 |
| [CLI package README](../../packages/data-platform-cli/README.md) | 已安装 CLI 的命令、profile 和本地验收使用说明 |

## 运行证据

| 文件 | 当前含义 |
|---|---|
| [cli-coverage-verification.json](../operations/cli-coverage-verification.json) | 三件套与 CLI 覆盖核对结果 |
| [cli-service-acceptance.json](../operations/cli-service-acceptance.json) | 已安装 CLI 的 capability 和 command dispatch 验收结果 |
| [aviation-ontology-cli-acceptance.json](../operations/aviation-ontology-cli-acceptance.json) | 航空项目、CLI profile、本体和验收限制 |
| [module-rollback-runbook.md](../operations/module-rollback-runbook.md) | 21 模块真实回退与重新升级操作约束 |
| [航空业本体 CLI 导入差异清单](../../航空业本体CLI导入差异清单.xlsx) | 344 项 Excel 导入的逐项成功、失败和待优化记录 |

`npm run acceptance:cli` 的当前合同为 596 capabilities、570 command definitions、1,166 dispatches 和 installed health `ok`。`npm run acceptance` 仍需真实外部 API、MySQL/PostgreSQL/Oracle/DM、模块回退和连续航空运行证据；证据不足时必须保持 `blocked`。

## 部署与领域工作流

| Skill | 用途 | 可安装包 |
|---|---|---|
| [data-platform-deployment](../../README/skills/data-platform-deployment/SKILL.md) | 安装、构建、启动 MySQL/PostgreSQL、前后端、CLI，并区分部署失败与输入数据阻塞 | [ZIP](../../README/skills/data-platform-deployment.zip) |
| [build-aviation-ontology](../../skills/build-aviation-ontology/SKILL.md) | 通过 CLI 构建和验收航空本体、ODS 治理、血缘、图谱及报表 | [ZIP](../../skills/build-aviation-ontology.zip) |

## 常用验证命令

```bash
npm run build
npm test
npm run install:cli:local
npm run acceptance:cli
```

发布或打包前同时运行 `git diff --check`，核对 `docs/operations/` 是最新运行生成的证据，并确认没有把密码、Token、API Key、运行缓存、截图或编辑器临时文件纳入提交。
