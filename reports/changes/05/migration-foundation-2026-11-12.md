# 05首批：目标5迁移基础

2026-11-12，小张/zwh9616（AI辅助），基于main b63dfdd。#35合同冻结已获小陈批准并合入e617cc0，main CI43202284398通过；小张审查交接#36，批准5873233078绑定486852f，完整PR CI43204606678后正常合入b63dfdd，main CI43205383891成功。实际来源保留在合同审定原件，本批只落实tasks2.1，不把05全量或运行页面记完成。

## 变更与范围

追加000005_assignment_tasks的五条CREATE及逆序down、SHA-256 manifest/机器available登记。admin/server共用migrations.Target=5：服务只读检查且不自动迁移，离线migrate/check/initialize精确要求5；repair只接受当前1..5、先校验旧历史/现存对象再补缺表。未改01..04的八个SQL字节及摘要。原健康3秒真实Ping、配置/TLS、DML/DDL分离、Compose四服务和13 current保留；九个05业务操作仍frozen。

| 表 | 数据与关键约束 |
| --- | --- |
| assignments | 原班级/教师、标题/说明/截止/版本/创建时间；班级+创建时间+ID分页索引；复合班级/版本唯一键供提交绑定 |
| submissions | 原作业/班级/版本/学生及原答案；复合FK绑定作业，公开task_id后续由唯一Task关联查询，避免循环FK |
| tasks | 每submission唯一Task；状态/attempt/epoch/version/取消、安全错误枚举、内部owner/租约及租约扫描索引；本批无执行器或状态变更服务 |
| task_outbox | 每Task一事件；可用时间/投递状态与扫描索引，不复制答案 |
| submission_idempotency | user/class/route/assignment/原key完整唯一作用域，32字节摘要及原202的submission/task/pending；复合FK强绑定同提交持有人与同Task；不自动清理 |

幂等键用VARBINARY(64)，防止MySQL字符排序规则将尾空格或大小写折叠；HTTP合法ASCII/长度与业务顺序后续实现时再校验，不把表约束替代它们。Schema检查精确列序/类型/可空性、默认值、字符排序、AUTO_INCREMENT、索引顺序/完整非前缀/可见BTREE、FK名称/分组/顺序及RESTRICT行为，漂移不能靠CREATE IF NOT EXISTS或盲force清除。生产CLI没有down/force；down仅在专用全空测试库验证。

## 实际验证与失败

原npm run check已通过：合同26组/215结构例+30边界双路径、155示例、前端28项、类型/构建、Go vet与随机测试、strict10/10；原8项批次检查保留并新增缺05迁移覆盖的拒绝。真实MySQL通过空库/4→5/重复执行、五处DDL中断与dirty阻断/漂移前置检查/显式repair重跑、原身份资料保持、历史摘要异常、复合FK/唯一Task/原key大小写尾空格区分、DML拒DDL、专用空库down。原3→4备份/恢复保持；新增真实4一致mysqldump隔离恢复，实际e617cc0旧server/admin拒5而可运行恢复4，新server/admin拒4、admin检查5成功，五账号原密码及资料原字节可用，升级5库保留。

上述真实成功先于最后新增索引前缀检查，最终完整gate仍待已提交源码执行，不以此代替最终证据。所有未执行项如实保留。

原错误均保留：新增migration5触发旧“仅1..4”合同断言，按已准入2.1更新到五个精确编号，业务激活拦截保留；批次旧反例只声明05而遗漏01/04一度漏拒，增加每个数据库消费者必须覆盖01/04/05的精确校验，原反例恢复通过。漂移夹具同ALTER删除/重加同名FK被MySQL1826拒绝，改用临时不同约束名后真实通过，未放宽产品检查。随后临时移除owner/route二进制排序拒绝，真实verify退出1并定位AT drift 2 accepted；finally逐字节恢复。新索引前缀检查与最终完整gate待跑。

[执行前事实](migration/pre-gate-facts.json) · [原失败/受控红及恢复日志](migration/pre-gate-logs.zip)。日志解包原文已用原规则Gitleaks扫描0，未增加豁免。

## 下一步

完成已提交最终代码的原完整gate（check/audit/secret-scan/verify）与四实际镜像/同轮同制品/清理，通过后交小陈审查本首批迁移PR。2.1尚未勾选；2.2—2.5（九操作、提交事务、幂等/outbox、worker租约/CAS/取消及全部21场景）和3.x仍待办。本批表/SQL夹具不是真实业务或AI/成绩完成，也不是任何持有人数据库已升级。

提交前秘密扫描因重排manifest使既有000003公开down摘要进入stdin diff上下文而命中generic-api-key；已独立重算八个旧SQL字节并与main一致，原件见migration/precommit-scan-failure.json。恢复旧manifest原布局、只在末尾追加000005条目，未改变任何摘要/扫描规则/豁免/范围，恢复扫描按实际结果核对。

## 最终干净源码与实际交接

干净源码314b3ba07b3228206f14a0e6193a4dc4cd32b49e原完整npm run gate于2026-11-12T11:25:39.629Z完成，check/audit/secret-scan/verify四段全0，notRun为空；verify434711ms。新索引前缀及其他七类漂移、空库/4→5/五DDL/显式repair与实际4/5制品及一致备份恢复均在该最终源码真实通过；四实际镜像HIGH/CRITICAL全0，批次source dirty=false，扫描/运行完整ID相同、四标签清理0，原身份资料/可信HTTPS/故障恢复/30次严格414及原3→4恢复保留。扫描数据库真实更新成功，没有跳过审计、失败子项或新增豁免。

[最终原始报告/完整日志](migration/final-code-gate-raw.zip) · [来源/门禁/镜像ID/清理与摘要汇总](migration/final-code-gate-summary.json)。后续仅补报告/任务/交接文档，运行输入不改；最终PR head自身CI仍须核对，不把314b3ba的本机结果说成后来head重复本机运行。

已创建[PR #38](https://github.com/zwh9616/campus-claw-plus/pull/38)，来源codex/05-runtime-2026-11-12，交小陈/Kevcco审查迁移基础。2.1按上述真实源码自测勾选；3.x最终独立终审/集成/归档未完成，不能据本首批或表内SQL夹具宣称AT-SC-02..19运行通过。2.2—2.5的业务HTTP/授权/配额/原子提交/租约CAS与完整竞争测试在后续实施，九操作仍frozen。06资料归档[PR #37](https://github.com/zwh9616/campus-claw-plus/pull/37)另交小葛，不随本分支提前归档。

最新主干整合：#33已获小葛批准并正常合入b631065，main完整CI43210635125成功；#34合入冲突由小张原分支处理，最终568c1ad实际批准5873900783/CI43211623059后正常合入86c9680，main完整CI43212246246已success。本提交逐块保留新主干两套原始证据和本候选范围；既有本机/旧head CI只对应其真实源码，不冒称新整合head已检查或批准，整合后的原合同/批次/strict/链接与秘密检查按实际输出确认。

整合收口：已对齐main86c9680并保留#33/#34全部实际合入及主干成功事实，见[进度合入事实](../10/B/progress-main-2026-11-12.json)。本次foundation、原26组合同行为/双路径、批次8项、strict10/10均通过，本地相对链接157个存在；秘密扫描及diff按本提交真实输出执行。backend/frontend/scripts/Compose/机器合同/阶段登记及服务批次输入与314b3ba逐路径比较无差异，原完整本机gate原件继续绑定314b3ba，不把当前纯进度整合说成另一次容器执行。最终整合head完整CI和实际成员审查另核，未获批准或合入。

资料归档整合：#37最终ae64bb4已获小葛实际批准、完整CI43223400847成功，正常合入main3c45f31；本提交逐块保留新主规约/归档及当前05首批状态，唯一批次输入变化为06 spec指向主规约。运行Go/SQL/配置与原314b3ba不变；整合head检查另核，原报告不冒充当前head容器执行。05后续作业/提交实现正在独立本地分支开发，未混入正在审查的#38。
