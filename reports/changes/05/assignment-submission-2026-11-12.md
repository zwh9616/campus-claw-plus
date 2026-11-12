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
| AT-SC-14/16/18/19的HTTP动作子集 | TestATMutationStatesAndRollback | 真实MySQL动作和两个写点回滚通过；failed/running由测试SQL建立合法快照，不作为worker竞争/CAS/终态执行完成证据；后补损坏快照503待最终复跑 |
| AT-SC-01/21默认制品子集 | wiring.verifyATWiring，原TestIDFWiring | 已加入Nginx→Go→可信TLS MySQL、双班/同班他人、容器/DB重建后同键原202和真实pending断言，最终原gate待跑 |
| AT-SC-20/21迁移/原01/04回归 | 原verify-identity所有用例、实际旧新制品矩阵和一致备份隔离恢复 | real-business-second全0，原失败留存，未删旧断言 |

原件暂存忽略目录output/business-logs。first-unit-fixture-failure记录Docker仅挂backend时测试读不到根fixture的真实失败；改为测试专用go:embed副本，并由原合同门禁逐字校验单源一致，未删向量。real-business-first/second为先前输入快照，不能替代最终源码完整门禁。受控将异载荷拒绝改为返回原202，真实MySQL测试出现status202 want409、退出1；finally逐字恢复，SHA256核对一致，red原件与恢复摘要保留。恢复后最终源SHA、全gate绿及原件摘要将在真实执行后补录。

## 尚未完成

完整原gate（check/audit/全历史与暂存秘密扫描/verify四镜像实扫及同轮运行ID和清理）尚待最终代码执行；不标已验证。2.4/2.5/3.x、21场景全量、另一成员终审、main集成、真实模型/成绩/作业页面未完成。下一步先完成本批门禁并交小陈审查，再按已批准任务实现worker。
