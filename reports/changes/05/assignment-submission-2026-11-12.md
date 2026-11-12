# 05 作业与原子提交实施记录（2.2/2.3）

执行人：小张/zwh9616（AI辅助），2026-11-12，Windows + 本机 Docker，原两位负责人为小陈终审/小张实现。本分支依赖迁移首批#38；迁移SQL、摘要、配置与服务清单不改，#38尚无实际批准，不提前合入。#35冻结已获审合入，不重新发明公共合同。

## 本批范围

实现九个已批准操作并在同一提交将OpenAPI、登记、运行装配与声明检查从13 current/9 frozen切为22 current。current仅表示此候选实际装配，正式合入、持有人升级和终审以共享表为准。

- 作业创建/列表/详情，提交创建/列表/详情，Task读取/本人retry/cancel；真实01会话、当前班级、完整资源链、学生本人范围和写前二次验证。教师只读任务，外班与本班他人统一404。
- 64KiB原始字节、Unicode码点、UTC毫秒截止、严格非空闭合JSON、非法UTF-16转义、正整数JSON版本（含1.0/1e0、大整数安全失配）、字符串ID、稳定分页与同一快照计数。
- 05独立用户12次/分钟配额，切班不重置；授权后先已提交重放/异载荷，再新版本/DB now<deadline及新写配额。同事务写submission/task/outbox/原pending202快照，无自动TTL，不将COMMIT应答错误当确定回滚。
- pending取消原子关闭同一事件；running只标记；failed且版本匹配/attempt<3重试同一Task且不重置计数；终态取消优先TASK_TERMINAL。真实worker竞争、claim/续租/租约接管/epoch CAS、自动退避与终态执行器仍是2.4，不计完成。
- 生产无执行器，启动一次固定说明；持久受理保持pending，不会模拟成功/生成成绩；无公开假批改入口、新配置或页面。

## 场景与实际证据

| 范围 | 真实测试 | 本次结果 |
| --- | --- | --- |
| AT-SC-02..05 | TestATRealHTTPAuthorizationInputsAndIdempotency，TestATConsistentPageSnapshotsAndExactIDs | real-business-second实际MySQL/HTTPS通过；双班五人、分页并发快照、>JS安全整数ID、wire/码点、配额隔离与切班 |
| AT-SC-06..08 | 同函数并发20同键等价JSON；TestATBusinessWritePointRollbackAndControlledDeadline；TestATCommitAcknowledgementAndRealCommittedReplay | 真实通过；四写点回滚、精确截止相等、150ms受控超时、真实COMMIT后丢回执与真实ROLLBACK后丢回执分列 |
| AT-SC-14/16/18/19的HTTP动作子集 | TestATMutationStatesAndRollback | 真实MySQL动作和两个写点回滚通过；failed/running由测试SQL建立合法快照，不作为worker竞争/CAS/终态执行完成证据；后补损坏快照503也在fdac13f最终原gate通过 |
| AT-SC-01/21默认制品子集 | wiring.verifyATWiring，原TestIDFWiring | 已加入Nginx→Go→可信TLS MySQL、双班/同班他人、容器/DB重建后同键原202和真实pending断言，fdac13f最终原gate三阶段均通过（正常/DB重启/全容器重建），会话及原202保留，Task真实pending |
| AT-SC-20/21迁移/原01/04回归 | 原verify-identity所有用例、实际旧新制品矩阵和一致备份隔离恢复 | real-business-second全0，原失败留存，未删旧断言 |

原件暂存忽略目录output/business-logs。first-unit-fixture-failure记录Docker仅挂backend时测试读不到根fixture的真实失败；改为测试专用go:embed副本，并由原合同门禁逐字校验单源一致，未删向量。real-business-first/second为先前输入快照，不能替代最终源码完整门禁。受控将异载荷拒绝改为返回原202，真实MySQL测试出现status202 want409、退出1；finally逐字恢复，SHA256核对一致，red原件与恢复摘要保留。恢复后最终源SHA、全gate绿及原件摘要将在真实执行后补录。

## 尚未完成

本批实现和自测2.2/2.3已完成，最终干净fdac13f原完整gate及代码CI均通过，详见下节。2.4/2.5/3.x、21场景全量、另一成员终审、main集成、真实模型/成绩/作业页面未完成。下一步先完成本批门禁并交小陈审查，再按已批准任务实现worker。

## 首轮完整门禁与修复

源码5a9034a：check/audit/全历史和暂存秘密扫描全部0，四个实际镜像HIGH/CRITICAL为0；默认HTTPS首轮作业创建/提交/隔离和原01/04均通过，但DB重启阶段夹具再次登录三个账号触发原登录源IP限流429，verify退出1，后续集成未跑。原始gate与四源结果已保留，不能将扫描成功说成完整门禁通过。

仅修测试夹具：在0700临时目录保留三个真实access会话，重启/重建阶段复用并纳入原秘密排除证明；不修改生产限流阈值、身份逻辑或增加假会话。复用同时验证持久会话可用。业务测试成功日志仅在子项全过时输出，受控红原失败仍保留。此次测试提交同提交同步共享表；新代码版本完整gate待真实重跑。

## 最终源码自测与交审

最终干净源码 **fdac13f919d35fb3a6b553dd91fcf73b5ef901c2**：本机原完整`npm run gate`退出0，check35676ms/audit9596ms/secret-scan8159ms/verify244630ms，notRun为空。该源码完整[CI43230410080](https://github.com/zwh9616/campus-claw-plus/actions/runs/43230410080)也completed/success。后续提交仅同步真实证据/状态/tasks，最终head CI另核，不将旧head绿灯当新head门禁。

四实际镜像HIGH/CRITICAL全0，原同轮扫描/实际运行ID一致断言通过，四标签与隔离项目/卷/网络清理0。真实默认Nginx→Go→TLS MySQL正常、DB重启、全容器重建三阶段均通过：使用同一持久学生会话和原key，仍返回相同submission/task/原pending202；读取真实Task为pending/attempt0/epoch0/version1，没有生产假执行。原登录/切班/退出、双班与同班他人隔离、健康真实Ping/DB503、原文下载/检索和30次严格真实414均保留。原身份/资料/迁移全套真实MySQL、五组新增业务用例、两种提交丢回执、4备份隔离恢复及真实4/5旧新制品矩阵全通过；受控异载荷拒绝红1后最终恢复绿，未删断言/放宽配额。

[原始ZIP](submission/final-code-gate-raw.zip)包含31个原件（先前失败、受控红、最终全gate/四源及镜像原始扫描），SHA256 `ec82328fe7b16d79f87706c152ac052ea18939d1d7fe2f3cd4ce175bd8489bdc`；[逐文件摘要清单](submission/evidence-manifest.json)、[结构化结论](submission/verification-facts.json)、[原件秘密扫描0](submission/evidence-secret-scan.txt)。不含临时账号/证书/答案/幂等原key；清单不打包临时测试私有会话文件。

已创建[#40](https://github.com/zwh9616/campus-claw-plus/pull/40)，原作者小张/zwh9616，按既定分工交小陈/Kevcco。#38仍需其实际批准并正常合入，本PR保留独立分支不改迁移审查输入；当前main差异中的既有SQL/摘要/阶段输入与#38最终7878164逐字不变。2.4 worker、2.5全部21场景、3.x、终审/合入/main复验及真实模型/成绩/页面仍未完成。本批动作SQL夹具不能替代worker竞争、续租、ABA与终态执行事务的验收。

## 持续跟进：同步迁移审查修复与最新主干

2026-11-12小陈在原#38发现并修复跨库外键漂移漏拒（4fbc93b，真实红1→绿0），随后整合#39主干2e4a71b，远端head0eabe92。本#40仅继承其修复/新增真实集成用例及主干证据，SQL与摘要不改；逐行解决共享表冲突，保留原执行者及#39主干原件。原c4e28b3完整CI43231722149成功仅说明原输入，新整合改变迁移检查运行代码，原完整gate/本head CI重新验证，不复用旧绿。#38终审期间不向其分支推送，2.4在后续独立分支继续，不混入#40审查范围。

整合1a018a1首次完整gate：前三段0/四镜像实扫0高危严重、默认HTTPS/重建通过；新增跨库外键用例在31号库遭遇业务测试已插入行，替换FK返回MySQL1452，verify1。原件保留。仅把该专用迁移测试库从31改36，保留所有拒绝/dirty断言及生产代码，新完整gate待跑；#38独立分支无此业务数据，不改其审查输入。
