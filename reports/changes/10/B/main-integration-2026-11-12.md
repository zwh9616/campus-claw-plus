# 10-B 第一批主干集成验收

2026-11-12，小陈 / Kevcco（AI辅助）核对。对应10的DO-SC-11..13、tasks B1.3；本批仅为01/02/04/06的mysql/admin/backend/frontend四服务。后续任务、MCP、模型及10-C仍按各自准入推进。

## 终审和实际合入

- 小葛 / gjj6666的[真实批准5872222879](https://github.com/zwh9616/campus-claw-plus/pull/32#pullrequestreview-5872222879)绑定最终head `510e882c9f20f349c909fba7ceeaf84ecb8f9b88`，其独立复验及本机完整gate超时的界限见[原终审](ge-review-2026-11-12.md)。小陈没有代其批准或声称本机Docker成功。
- 该head的[完整PR CI43192454795](https://github.com/zwh9616/campus-claw-plus/actions/runs/43192454795)成功。小葛于2026-11-12T09:46:16Z正常合入[#32](https://github.com/zwh9616/campus-claw-plus/pull/32)，实际main为 `b4b13fde47bf39f2d478ff6a2721df23a04680d9`。
- `git rev-parse <获批head>^{tree} <集成SHA>^{tree}`均为 `9c58992145b8df0e930e547ee003191f706e41d4`，文件树完全一致。GitHub回读main protected=true，本账号admin=false，实际check成功；完整管理员保护接口本次404，不冒称重新读取全部设置。有效保护的历史完整配置与受控阻断实验见[10-A共同记录](../A/main-integration-2026-11-07.md)。没有修改保护或使用管理员绕过。
- [API回读事实](main-integration/github-facts.json)记录实际审批人、合并人、时间、SHA与主干检查，和CI原件分列。

## 集成提交真实CI

[主干完整CI43194409869](https://github.com/zwh9616/campus-claw-plus/actions/runs/43194409869)为push事件，head及原件source.commit均为上述main，工作树clean。Node22.23.4；四段全部0，notRun=[]：check42243ms、audit749ms、secret-scan1239ms、verify151759ms。原镜像扫描、默认Compose/HTTPS和真实MySQL三个程序分别59471/69309/22573ms，均退出0。

小陈下载artifact13931299762，重算原始ZIP SHA-256为 `29596aba7789163b7980494244bb6391ac1e74173403e8652fda23582aa32a11`，与GitHub digest完全一致；逐份重算四份源报告摘要，再用现有validateRuntimeEvidence重新校验本轮时间窗、Dockerfile摘要、四镜像0 HIGH/CRITICAL、运行与扫描完整image_id相同。四个临时扫描标签清理均0。

| 真实链路 | 结果 |
| --- | --- |
| 默认主机同源HTTPS、CA/SAN拒绝、匿名拒绝、配置缺失/非法 | 原回归通过；不是仅容器内443可用 |
| 停DB后的health503、真实探针非零、静态首页200 | 原回归通过，不改变唯一MySQL健康合同 |
| DB恢复、保留卷完整容器重建、身份/班级及资料持久化 | 原回归通过 |
| 合法2000码点检索、2001码点拒绝、超限请求行414 | 初启/DB重启/全容器重建三个真实阶段均通过；所验源码每阶段10次414，不能用连接错误代替 |
| 原真实SQL身份、迁移、备份、旧制品拒绝及隔离恢复 | 原verify:identity通过；不代表05迁移或长期生产备份运行 |
| 生成秘密不进入镜像/前端/日志、全历史与暂存扫描 | 原回归通过；本地新增原件提交前另扫描 |

原始[CI ZIP](main-integration/evidence.zip)、[完整门禁](main-integration/gate-results.json)、[本轮批次报告](main-integration/batch-results.json)及[摘要核对事实](main-integration/verified-facts.json)可追溯。摘要核对是读取真实CI原件，不冒称小陈另一次Docker执行。此前本机缺Docker退出1、小葛首次制品ID不符及完整gate600秒124均保留，没有改为通过。

## 本次补证提交的本机检查

Windows，Node24.22.1/npm10.5.0/Go1.27.3。本次仅改变进度、任务、文档与已有机器索引的审查状态，未改运行实现。`npm run check`退出0，含批次8项、资料28项、Go及strict10/10；`npm run audit`退出0（两处零漏洞），全历史/暂存秘密扫描退出0。新下载ZIP内全部原始JSON经gitleaks stdin扫描退出0；`git diff --check`退出0。对应输出保留在忽略目录output/10-b-acceptance-*.log。本机仍缺Docker，本轮未再次执行已知会因此失败的verify；本补证head自身完整CI由正常PR门禁另验，不能复用上述main CI作为新head检查。

## 结论及下一步

真实最终head批准、正常合入和同SHA主干完整验收已齐，B1.3完成；本提交同步机器索引reviewed、任务与共享表。只完成B第一批，4.1..4.4全量、10-C及整体归档仍未完成。

05规约及公共机器合同[#35](https://github.com/zwh9616/campus-claw-plus/pull/35)已由原负责人审定并合入main e617cc0，下一步由小张按既定05实施与自测。九个操作/资源Schema/错误码/权限配额/摘要向量及000005仍仅在其独立候选范围，不从本补记启用。06资料阶段归档仍由小葛/小张接力。本次不修改生产配置/路由/SQL或启动其他暂停变更。

小葛/gjj6666（AI辅助）2026-11-12终审补记：已独立复核同一main b4b13fd原始artifact及四份报告摘要、正式review与树一致性。元数据仅pending_ge_review→reviewed，批次8项/基础检查/strict10/10亲自复跑0；正文及共享表把“05机器合同未提交”更新为#35候选待小陈审定，不导入其合同或提前apply。旧本机缺Docker1、完整gate网络超时124与实际CI成功分别保留，B全量/C不提前完成。

## 同步已审主干e617cc0

审查期间#35已由小陈/Kevcco批准5872964547（head7fe5b5d）并正常合入main e617cc0，主干完整CI43202284398四段0；原始artifact13935334564及ZIP摘要已由小葛独立回读核对。原13 current不变，新增九个frozen只是机器合同，运行目标4、生产Go/前端/Compose/Dockerfile均未变，05真实实现仍待小张按2.x推进。

本分支逐块解决进度/任务文档冲突，完整继承该已批准主干的Schema/合同检查，1.3按真实批准与合入补勾；未删陈的耗尽反例或撤回任何冻结合同。旧b4b13fd原件继续只代表其实际版本，不冒充本次新head检查；本候选的最终CI及本人review按新head重新核对。B全量/C和06归档仍待验，合入本候选仍需当前明确授权。

本轮承接e617cc0后，亲自复跑合同双路径/26组行为测试0、strict10/10；160个本地文档链接均存在。#34额外批次8项0，后续完整CI/实际review仍绑定本候选新head。


## 小陈同步main e617cc0（2026-11-12）

本次在原#34分支先快进保留小葛510cf58全部修改，再合入已通过完整CI43202284398的main e617cc0；只手工合并共享表顶部及10行两处冲突，保留main全部05合同/测试/Task耗尽修复，不改业务运行代码或门禁。05公共合同#35已获真实批准并正常合入，1.3验收补记交[#36](https://github.com/zwh9616/campus-claw-plus/pull/36)由小张审查；后续10-B增量等05真实实现，不把合同冻结当服务已接入。

本次同步后的Windows Node24.22.1/npm10.5.0/Go1.27.3实际执行npm run check/audit/secret-scan及diff检查均0，包含合同26项、前端28项、批次8项、Go及strict10/10；完整本机verify因缺Docker未重跑，最终head完整CI/小葛实际终审仍须重新核对，不沿用旧head绿灯或伪造自己的PR批准。见[命令及原件索引](main-integration/sync-e617-local-checks.json)。原四份未跟踪文件哈希不变，没有提交个人配置或凭据。


## 小陈同步main b63dfdd（2026-11-12）

上轮eede651完整CI43204463920已成功，原始artifact13937201648重新核验通过，已交小葛；随后小张对#36最终486852f实际批准5873233078并正常合入main b63dfdd，形成新的共享表冲突。本次只在五处共享表冲突内保留main最新05验收/1.3与小张复核，保留本分支小葛复核及10-B首批验收行；不整文件选一侧，不改运行代码、合同、任务完成依据或他人历史失败。

本次Windows Node24.22.1/npm10.5.0/Go1.27.3实际完整check/audit/diff均0（26合同、28前端、8批次、Go、strict10/10），见[命令与原件](main-integration/sync-b63-local-checks.json)。完整本机verify因缺Docker未重跑。记录时main b63dfdd完整CI43205383891尚在进行，不提前宣称通过；本提交最终head完整CI、当前main检查及小葛实际批准仍须按远端核对。

小葛最终整合说明：保留作者eede651与本轮772622f两个e617cc0对齐提交及新增本机日志，不覆盖其原件；相对最新主干的Schema/合同检查无额外差异，业务运行代码不变，唯一机器登记差异仍为本批reviewed。下一步由本候选最终head的完整CI及本人review收口，未得到本次明确授权前不合入#34。


并发整合补记：推送本次main b63dfdd同步时，远端已先到小葛59cd47d，普通Git拒绝非快进。我已读取其772622f/59cd47d并在GitHub说明接手范围，随后正常合并，保留其AGENTS/README/迁移登记更新、整合说明和原件；四个冲突文件只在冲突块内保留较新的main05验收及双方10-B说明，不强推。小葛关于本轮合并授权的界限作为其实际说明保留，由其本人审查并依保护收口；本次不代其批准或合并。最终整合后的检查以本提交实测和新head CI为准。


最终双方整合后实际复跑完整check/audit/secret-scan及diff均0（26合同、28前端、8批次、Go、strict10/10），原始文本与[记录](main-integration/peer-sync-local-checks.json)随本提交保留。API随后确认main b63dfdd完整CI43205383891已成功；前述“进行中”保留为当时快照。本机verify仍因缺Docker未重跑，当前提交自身完整CI和小葛实际review不能由该主干成功替代。
