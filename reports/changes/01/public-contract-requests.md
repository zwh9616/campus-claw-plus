# 01公共合同请求与处理结果

## 2026-11-06 最新结果（覆盖下方历史待定状态）

小张按组长新规则在原 PR #6 直接收口 PCR-IDF-01..03。新增 [公共修订 change](../../../openspec/changes/2026-11-06-identity-public-contracts/proposal.md)、[阶段登记](../../../docs/contracts/identity-phase.json)、[七键登记](../../../docs/contracts/config-register.json) 和迁移保留号。健康在 01 引入 MySQL 的同一受审实现提交原子切换；当前仍仅空依赖健康和 HTTP_PORT。最终 review 绑定当前 head，未冒称小葛批准，未实现数据库或 HTTPS。

以下保留小陈原始请求及当时反馈，作为方案来源，不继续表示现行待定项。

# 01向00提交的公共合同修订需求

日期2026-11-05；提出人小陈，确认与维护00单源合同仍由小葛/小张负责。本文件是PR #6的修订需求，尚未批准；没有改docs/contracts、主规约、.env.example、Compose或探针，不建立第二套生效规则。00由PR #5合入main 4cfd61d8119c51bc3bf2870a17c9754f0975b3dc；该SHA的main CI与小张本机check/verify复验已留证，G2按00 D8成立。main有效保护规则仍为空，失败合并阻断是10前置G3的未完成工作，不倒推否定G2。

| 请求编号 | 当前合同及差异 | 请00两人确认的修订 | 受影响位置与验收 |
| --- | --- | --- | --- |
| PCR-IDF-01 数据库健康 | Health.schema只允许status=ok、dependencies={}；OpenAPI /health没有DB失败合同，现探针精确检查骨架载荷 | 01真实接入MySQL时，候选为200 {status:ok,dependencies:{mysql:up}}；3秒真实Ping失败503 {status:error,dependencies:{mysql:down}}。字段与超时先由00确认后冻结，不同时把两种载荷都当当前合同 | Health Schema、OpenAPI、合同正反例、阶段登记、后端规范/部署规范及/server --healthcheck同一次获批变更同步；01/10/11验证依赖断开→503/探针非零→恢复200，无配置值泄露 |
| PCR-IDF-02 配置和HTTPS | config-register当前只有HTTP_PORT，01仅planned names_frozen=false；样例仅空HTTP_PORT | 逐项审runtime-plan R2七个空键：MYSQL_DSN、MYSQL_MIGRATION_DSN、MYSQL_CA_FILE、AUTH_TRUSTED_ORIGIN、AUTH_TRUSTED_PROXY_CIDRS、HTTPS_CERT_FILE、HTTPS_KEY_FILE。确认使用者、机密分类、必填阶段、代理信任、TLS、超时和失败行为；真实值只运行环境 | config-register及安全/后端/部署规则、01/02/10范围协调；确认后再由01获准实施包扩展样例和接线。小陈负责Compose/Nginx/TLS/MySQL接线并交小张审，小张负责Go装配/迁移；10后续复用并验运行观测。缺失/空白/非法非零，Cookie Secure不降级、Origin精确匹配、证书必须验证 |
| PCR-IDF-03 迁移号及公共接线窗口 | migration-register工具未选、实际清单空；公共配置和装配尚未准备01运行能力 | 提请小张协调runtime-plan R1的migrate v4.20.1和候选000001..000003；登记SQL/manifest摘要、前后置检查、dirty/部分DDL修复与重试。确认驱动MPL-2.0和MySQL GPLv2的用途/许可，再引入 | 迁移登记、小张Go依赖/身份装配窗口、小陈Compose/CI窗口；01空库/升级/故障恢复场景，10只复用及扩展观测；不在G2前安装业务依赖或改Compose |

具体方案见[01 runtime-plan R1..R6](../../../openspec/changes/archive/2026-11-04-identity-foundation/runtime-plan.md)，每一项允许“同意候选”或“具体替代方案”，但须绑定修订head并同步唯一合同。00现已合入main；请小葛/小张以新的公共合同修订change维护主规约、Health Schema、OpenAPI、配置及迁移登记，不能倒改归档历史，也不在PR #6私写第二套。建议顺序：小张审01候选与版本/许可/摘要/迁移号；00原两人审新公共修订并按门禁合入；小张复审与公共修订对齐的01规约；G2虽已成立，仍待01批准及依赖冻结后才实施，G3及终审后才合并实现。健康/配置未确认时01保持待审和不apply。

小张已在[PR #6逐项反馈](https://github.com/zwh9616/campus-claw-plus/pull/6#issuecomment-6659982126)接受版本/许可用途、候选迁移号、目标健康和七键方向，要求迁移DSN继承业务DSN的TCP目标、库名和完整证书校验，并请小葛明确无DB到有DB的健康合同切换时点。此反馈是公共修订输入，未建立或批准新公共change，不代表01整体获批。

这不是小陈对00实现的终审；00仍由原两人审查。提交此需求也不表示小张已批准01。实际发布位置以PR #3中的PCR-IDF-01..03请求评论为准，PR #6承担01方案复审。
