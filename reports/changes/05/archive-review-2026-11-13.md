# 05 作业与持久任务基础：主干验收与归档候选

2026-11-13，小陈 / Kevcco（AI辅助）在已验收 main `d06198de7cbff56b4304b3483aeec32ad9a3e085` 上准备归档。本分支 `codex/05-archive-2026-11-13` 仅同步主规约、归档、索引与真实验收记录，交小张核对；归档 PR 的批准、正常合入和最终 main 复验尚未完成。

## 实际终审、合入与主干验收

| 实现批次 | 最终 head / 小陈实际批准 | 正常合入 main | 精确主干完整 CI |
| --- | --- | --- | --- |
| #38 迁移基础 | 22860fd / 5876304145 | fc5c2355d386739542dd75d25fd6154cf49575d1 | 43239351413，success |
| #40 HTTP 与原子幂等受理 | a485b94ffa4b7c2d31a6564014e5e3bb444f51ad / [5877403365](https://github.com/zwh9616/campus-claw-plus/pull/40#pullrequestreview-5877403365) | f7eb856952793c23ec139ad233c60386b1b394b6 | [43250820540](https://github.com/zwh9616/campus-claw-plus/actions/runs/43250820540)，success |
| #41 持久 worker | e59b57a2f7f3b53c497df1732528e276f9cfedd3 / [5885799083](https://github.com/zwh9616/campus-claw-plus/pull/41#pullrequestreview-5885799083) | d06198de7cbff56b4304b3483aeec32ad9a3e085 | [43362518043](https://github.com/zwh9616/campus-claw-plus/actions/runs/43362518043)，success |

本人通过 GitHub API 重新核对 #40/#41 的批准绑定最终 head、正常合入、获批树与 main 整树相同、main protected=true，以及上述精确 push CI completed/success。[#40 事实](archive/pr-40-integration.json) · [#41 事实](archive/pr-41-integration.json)。#41 合入前完整 PR CI43251835049 也已成功，临时集成树与最终 head 同为 `0c46acc490690816be0bca0d7bca1d9c0d4c4dc0`。

## 原始制品独立回读

| 实际 CI / API artifact | 原始 ZIP SHA-256 | 原件及校验摘要 |
| --- | --- | --- |
| #40 main 43250820540 / 13959481587 | b06e918f422fffdc0db73947840b3188acced8e13895bd1231f66d45c23c0d4a | [ZIP](archive/http-main-evidence.zip) · [校验事实](archive/http-main-verified.json) |
| #41 PR 43251835049 / 13960950640 | 9ab8656c47cca57eb6e8c9fe120ee2809c361fe170552d5f59d166022a2cdeaa | [ZIP](archive/worker-final-pr-evidence.zip) · [校验事实](archive/worker-final-pr-verified.json) |
| #41 main 43362518043 / 14008414768 | 77fbd1916ffc87246c78bc0222e9f774d459009d648262b4c8e1a37568215d99 | [ZIP](archive/worker-main-evidence.zip) · [校验事实](archive/worker-main-verified.json) |

三份均已实际下载并重算 ZIP 摘要，与 GitHub API 一致；check/audit/secret-scan/verify 四段均0、notRun为空，干净源码、四源报告 SHA-256、四个实际镜像 HIGH/CRITICAL=0、同轮实扫/运行镜像 ID、四项清理0均通过。主干 #41 原始日志包含六组作业/提交/迁移回归及八组 worker 顶层真实 MySQL 测试，没有 SKIP；三阶段默认可信 HTTPS 验证新受理、查询、数据库重启和保留卷重建后的原提交、原 Task、原202及答案持久性，生产保持 pending/attempt0。原身份、资料、健康、4与5隔离恢复及严格414回归仍在同一门禁内。

这些是本人核对的 CI 原件，不冒称今天在本机又运行了一轮 Docker。本人 2026-11-12 的独立 Docker 完整 gate、真实幂等和租约条件“故意破坏退出1→逐字恢复退出0”、竞争与崩溃复测，继续由[原始独立终审记录](chen-http-worker-review-2026-11-12.md)及其 ZIP 证明；作者自测与本人复测分列。此前缺 Docker、夹具冲突、受控失败和历史待验证快照均保留，最终通过不改写过去结果。

## 场景与证据范围

| 场景 | 实际验收依据 |
| --- | --- |
| AT-SC-01 | #31规约、#35公共冻结的真实批准及主干验收先于 apply；#38/#40/#41分批实施并由小陈终审。 |
| AT-SC-02..04 | 真实 HTTP 双班教师/学生与同班他人、会话失效、逐资源同构404、教师写/学生只读、严格JSON/Unicode/字节/分页/版本和独立05配额。 |
| AT-SC-05..08 | 真实MySQL四类记录同事务、20并发同键等价JSON、原202重放优先于截止/新写配额、精确deadline、四写点回滚及丢COMMIT回执后的持久查询；默认HTTPS重启与重建恢复。 |
| AT-SC-09..10 | 生产未绑定执行器零claim、真实pending；测试二进制使用同一持久仓储/调度，真实子进程在claim前后终止、新随机owner恢复、重复事件及SIGTERM有界退出。 |
| AT-SC-11..15 | 到期未接管旧续租/终态拒绝、owner/epoch/ABA、每次claim单增、前两次1/2秒退避、三次全生命周期上限、手动retry版本与第三次过期清理。 |
| AT-SC-16..19 | 真实行锁/事务屏障的取消与claim、取消与成功两种顺序；状态、回执适配器与outbox逐写点注错整体回滚，陈旧租约不得落结果。 |
| AT-SC-20..21 | 真实空库/4→5、五处DDL中断及前向修复、跨库FK漏拒受控红绿、dirty/摘要/结构漂移阻断、实际旧新制品及隔离恢复4；全门禁/HTTPS权限/失效/原01/04回归，幂等与租约权威条件真实红绿。 |

详细映射和原件见[迁移独立终审](chen-migration-review-2026-11-12.md)、[HTTP自测](assignment-submission-2026-11-12.md)、[worker自测](worker-2026-11-12.md)、[小陈独立复测](chen-http-worker-review-2026-11-12.md)。

## 归档候选与下游交接

锁定 OpenSpec1.13.0 执行 `archive 2026-11-12-assignment-tasks --yes`，退出0，生成[assignment-tasks主规约](../../../openspec/specs/assignment-tasks/spec.md)，并移动[完整原change](../../../openspec/changes/archive/2026-11-12-assignment-tasks/)。保留8项需求和21个场景的条款原文；Purpose补足用途及D1—D9设计入口。tasks3.2据真实集成补勾，3.3仅表示本分支归档候选已生成，等待小张核对和正常合入；未将main写成已归档。

端点/OpenAPI的来源、部署批次spec路径及合同检查中的精确来源断言只迁移路径；业务代码、SQL字节、Schema/fixture、配置、镜像、Compose和检查强度保持。历史archive及第7课不倒改。

| 接收变更 / 负责人 | 已可使用的真实边界 | 仍须满足的前置与验收 |
| --- | --- | --- |
| 06 作业页面 / 小张、小葛 | 九个current接口、可信会话/班级、作业与私有提交、原202和Task读取/重试/取消；202表示持久受理，界面应如实呈现pending。 | 作业页面尚未交付；准备自身规约并按两人评审批准后apply，不把资料阶段归档扩大成作业页面批准。 |
| 07B 教学技能 / 小葛、小陈 | 已验证的持久调度、有效租约/CAS、重试/取消和事务结果适配器边界。 | 生产未绑定执行器或结果适配器，不claim；需明确恢复、自己的规约批准和真实模型/取消/安全验收，不以测试回执表代成绩。 |
| 08 成绩 / 小陈、小张 | 提交与Task的可信资源关联及原子结果事务边界。 | 无生产成绩表/GradeResult/分数交付；依赖真实07B及自身批准，其他暂停项本次不恢复。 |
| 运行持有人 | Target=5，空库离线迁移；已有4先停写、保存一致备份，再用离线admin升级5。 | 本次没有升级持有人库或启动长期部署；回退使用隔离恢复4备份和已验收旧制品，保留5库，不能把down或停机当持有人生产回退。 |

## 本分支实际验证与交接

本机 Windows，Node24.22.1/npm10.5.0/Go1.27.3；根 `npm ci`、`npm run setup`、完整 `npm run check`（含Go vet/test、合同、构建及strict10/10）、`npm run audit` 全部退出0，根和前端审计均0漏洞。全历史193提交与暂存秘密扫描退出0，三个CI ZIP解包原件分别扫描也均0；未新增豁免。8项需求/21场景原文、路径、合同元数据、运行输入及旧归档一致性检查通过，260个本地链接有效。[一致性核对](archive/archive-consistency.json) · [check原件](archive/05-archive-check.txt) · [audit原件](archive/05-archive-audit.txt) · [原件秘密扫描](archive/05-archive-raw-secrets.txt) · [历史/暂存扫描](archive/05-archive-secret-scan.txt)。完整容器回归已由上述精确main CI真实执行，verify168924ms；本轮没有在缺Docker的本机重复运行容器测试，归档自身PR的完整CI仍须按最终head另核。

原四份本地未跟踪文本保留，未纳入Git。没有生成或提交真实凭据、配置、私钥或学生答案。本轮没有重新申请SSH授权；上次两条临时授权及临时密钥已清除。

归档候选已提交为[PR #42](https://github.com/zwh9616/campus-claw-plus/pull/42)，并通过GitHub实际请求小张/zwh9616审查。请求不等于批准；本次交接补记仅改报告及共享表，运行输入与已验收main保持。本PR最终head完整CI、小张实际批准、正常合入及归档main复验另核，未代批准或提前合并。
