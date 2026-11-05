# 01向00提交的公共合同修订需求

日期2026-11-05；提出人小陈，确认与维护00单源合同仍由小葛/小张负责。本文件是PR #6的修订需求，尚未批准；没有改docs/contracts、主规约、.env.example、Compose或探针，不建立第二套生效规则。引用00候选75cadbf，main仍2bf12e2、G2未成立。

| 请求编号 | 当前合同及差异 | 请00两人确认的修订 | 受影响位置与验收 |
| --- | --- | --- | --- |
| PCR-IDF-01 数据库健康 | Health.schema只允许status=ok、dependencies={}；OpenAPI /health没有DB失败合同，现探针精确检查骨架载荷 | 01真实接入MySQL时，候选为200 {status:ok,dependencies:{mysql:up}}；3秒真实Ping失败503 {status:error,dependencies:{mysql:down}}。字段与超时先由00确认后冻结，不同时把两种载荷都当当前合同 | Health Schema、OpenAPI、合同正反例、阶段登记、后端规范/部署规范及/server --healthcheck同一次获批变更同步；01/10/11验证依赖断开→503/探针非零→恢复200，无配置值泄露 |
| PCR-IDF-02 配置和HTTPS | config-register当前只有HTTP_PORT，01仅planned names_frozen=false；样例仅空HTTP_PORT | 逐项审runtime-plan R2六个空键：MYSQL_DSN、MYSQL_MIGRATION_DSN、MYSQL_CA_FILE、AUTH_TRUSTED_ORIGIN、HTTPS_CERT_FILE、HTTPS_KEY_FILE。确认使用者、机密分类、必填阶段、TLS、超时和失败行为；真实值只运行环境 | config-register及安全/后端/部署规则、01/02/10范围协调；确认后再由已获准实现扩展样例和接线。缺失/空白/非法非零，Cookie Secure不降级、Origin精确匹配、证书必须验证 |
| PCR-IDF-03 迁移号及公共接线窗口 | migration-register工具未选、实际清单空；公共配置和装配尚未准备01运行能力 | 提请小张协调runtime-plan R1的migrate v4.20.1和候选000001..000003；登记SQL/manifest摘要、前后置检查、dirty/部分DDL修复与重试。确认驱动MPL-2.0和MySQL GPLv2的用途/许可，再引入 | 迁移登记、小张Go依赖/身份装配窗口、小陈Compose/CI窗口；01空库/升级/故障恢复场景，10按同源HTTPS/隔离DB后续接线；不在G2前安装业务依赖或改Compose |

具体方案见[01 runtime-plan R1..R6](../../../openspec/changes/2026-11-04-identity-foundation/runtime-plan.md)，每一项允许“同意候选”或“具体替代方案”，但须绑定修订head并同步唯一合同。00如先完成归档，需通过新的公共合同修订change维护主规约，不能倒改归档历史。健康/配置未确认时01保持待审和不apply；业务实现合并另外等10前置G3及自己的终审。

这不是小陈对00实现的终审；00仍由原两人审查。提交此需求也不表示小张已批准01。实际发布位置以PR #3中的PCR-IDF-01..03请求评论为准，PR #6承担01方案复审。
