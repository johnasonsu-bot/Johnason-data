# 第三方组件与许可证说明

本源码包包含为实现已交付功能所必需的第三方组件。各组件的著作权和许可证仍归其权利人所有，本说明不改变任何第三方许可证条款。

## Apache DataX

数据接入运行时包含 Apache DataX 的必要核心文件及经过白名单筛选的 Reader、Writer 插件。DataX 按 Apache License 2.0 使用，许可证全文可在 Apache Software Foundation 官方网站获取：<https://www.apache.org/licenses/LICENSE-2.0>。

## Node.js 依赖

前端和后端通过 npm 管理依赖，实际交付版本以各工程中的 `package-lock.json` 为准。每个 npm 包按其自身声明的许可证使用；买方在修改、升级、再分发相关依赖前，应自行核对对应许可证和通知义务。

## 不随包交付的第三方资源

源码包不包含任何第三方云服务账号、数据库账号、消息系统账号、模型 API Key、访问令牌、私钥、证书或生产环境凭据。买方需自行合法取得并配置所需的外部服务与凭据。
