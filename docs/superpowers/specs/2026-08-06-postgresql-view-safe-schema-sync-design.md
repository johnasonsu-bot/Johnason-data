# PostgreSQL 视图依赖安全的目标表结构同步设计

## 目标

修复接入任务保存或运行时对 `ods_flight_schedule` 执行无效字段类型变更，导致 PostgreSQL 报错 `cannot alter type of a column used by a view or rule` 的问题，同时保持现有语义层视图可用。

## 根因

1. 前端只要看到 `targetConfig.table` 就把已有任务推断为“新建目标表”，忽略已持久化的 `targetTableMode=existing`。
2. PostgreSQL 元数据比较使用原始类型字符串，无法识别 `varchar`/`character varying`、`timestamptz`/`timestamp with time zone` 等等价类型。
3. 任意字段属性差异都会生成 `ALTER COLUMN ... TYPE`，即使实际只需要调整默认值或可空性。
4. 接入任务的目标类型归一化会把 PostgreSQL 原生 `jsonb`、`timestamptz` 降级为 `text`。

## 方案

- 目标表模式以任务持久化值为准；缺失该值的历史任务默认按“使用已有表”处理，只有显式选择时才进入“新建/同步结构”模式。
- 后端持久化 `targetTableMode`，保证编辑、保存、运行的语义一致。
- PostgreSQL 字段比较先做类型别名和参数归一化，再分别比较类型、可空性、默认值和主键。
- PostgreSQL 结构同步只对真实类型差异生成 `ALTER TYPE`；可空性和默认值使用独立语句。
- 原生保留 `json/jsonb/timestamptz/timestamp with time zone` 等类型。
- 不自动删除或重建依赖视图；若确实存在不兼容的真实类型变更，保留明确错误并要求显式迁移。

## 验收标准

- 编辑和运行任务 137 时不再尝试把 `ods_flight_schedule` 的等价字段类型改写。
- 9 个现有 DWD/SEM 依赖视图保持存在且可查询。
- `jsonb`、`timestamptz` 类型在任务保存和结构比较后不降级。
- 类型等价、仅可空性变化、仅默认值变化均有自动化测试覆盖。
- 航空本体全体对象的数据服务发布后，可使用统一应用 Token 访问，并能返回对象清单和对象数据。

