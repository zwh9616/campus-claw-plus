# 05公共机器合同审定与main集成验收

2026-11-12，小陈 / Kevcco（AI辅助）。本记录收口既有05变更的tasks 1.3，不新建业务变更，也不代表2.x/3.x完成。小张在#35提交D9及公共合同，小陈按协作规范直接修复、验证并审定最终head。

## 实际批准与正常合入

| 项目 | 实际结果 |
| --- | --- |
| 既有规约 | #31最终ef3553f已获小张批准并合入main da8624c；原批准及主干门禁证据保留 |
| 公共合同PR | [#35](https://github.com/zwh9616/campus-claw-plus/pull/35)，小张提交，小陈审定 |
| 最终受审head | `7fe5b5d8f0500ec6a2e26a1aafbe09eb354f70a5` |
| 真实审查 | Kevcco的[APPROVED 5872964547](https://github.com/zwh9616/campus-claw-plus/pull/35#pullrequestreview-5872964547)，绑定上述最终head |
| PR完整CI | [43201368800](https://github.com/zwh9616/campus-claw-plus/actions/runs/43201368800)，completed/success；CI实际检出测试合并提交`a5a7f0bba3d7d13f980f1ec5158920e40dd8862c` |
| 正常合入 | Kevcco于2026-11-12 10:39:21 UTC正常合入main `e617cc00f067cfee84aca0fd69687c385c9b2982`，未绕过保护、未强推 |
| 文件树核对 | 受审head、PR测试合并提交及main合入提交的tree均为`3cf0663f1513dce2c9a0263e1f6f76c9a058d3cb`；受审head与main文件差异为空 |
| main完整CI | [43202284398](https://github.com/zwh9616/campus-claw-plus/actions/runs/43202284398)，push事件、上述main SHA，completed/success |
| 主干保护 | GitHub在本次核对返回main protected=true；没有修改保护或冒称其他成员批准 |

批准/合入/main检查原始API事实见[github-facts.json](contracts-main-integration/github-facts.json)。D9是#35审定内容，未倒写成#31的历史批准。

## 真实门禁与制品复核

| 实际CI来源 | check | audit | secret-scan | verify | notRun |
| --- | --- | --- | --- | --- | --- |
| PR43201368800 | 0 / 55198ms | 0 / 908ms | 0 / 1773ms | 0 / 158273ms | 空 |
| main43202284398 | 0 / 56778ms | 0 / 910ms | 0 / 1810ms | 0 / 159263ms | 空 |

小陈实际下载两轮GitHub原始ZIP，分别核对下载摘要、batch来源提交/dirty=false、同轮原始报告SHA-256、四个镜像扫描与实际运行的完整image ID一致及清理结果；不是仅看CI绿勾。原三个容器验收程序全部退出0。两轮mysql/admin/backend/frontend均HIGH=0、CRITICAL=0，各四个保留标签清理均0；两轮分别构建，未要求跨轮image ID相同。

- PR artifact `13934779877`，名称绑定`a5a7f0b...`，摘要`sha256:99eea16a122095a69610be5565c1957735a912c69dfacef6da0530cfbfacb92f`，见[原始ZIP](contracts-main-integration/pr-evidence.zip)和[逐项核验事实](contracts-main-integration/pr-verified-facts.json)。
- main artifact `13935334564`，名称绑定`e617cc0...`，摘要`sha256:ab9f5deb957475865584ce38c5e6bc2d2b92d99cfd27b1af49a8101c552f1eb2`，见[原始ZIP](contracts-main-integration/main-evidence.zip)和[逐项核验事实](contracts-main-integration/main-verified-facts.json)。

两轮真实运行均通过正常CA/SAN校验的同源HTTPS、身份失效/越权、MySQL停机健康503而静态页200、恢复/完整容器重建持久化、01/04及迁移隔离恢复回归；三阶段资料请求行边界各10次严格断言保留。它们是现有运行基线回归，**不是尚未实现的05数据库/并发/worker/AI验收**。

本机Windows Node24.22.1/npm10.5.0/Go1.27.3执行的原gate前三段0、verify因缺Docker退出1仍保留在[小陈审查与红绿原件](chen-contract-review-2026-11-12.md)。本次主干验收依据上述真实CI运行，未把本机失败、合同合成例子或小张旧head结果冒称通过。补记文档的本机检查见[local-doc-checks.json](contracts-main-integration/local-doc-checks.json)；补记PR仍须自身CI及实际评审。

本补记实际执行foundation、strict规约10/10、原合同26项测试、79个相对链接及diff检查均0；全历史165提交及暂存内容秘密扫描均0。没有为纯验收补记重跑缺失Docker的本机运行阶段，也没有用上述文档检查替代两轮完整CI。

## 1.3完成与实际下一步

小张已确认000005候选号、五表及升级/修复/隔离恢复方案；小陈实际审定D9、九操作/单源Schema、错误/权限/05配额/原202重放和真实Go摘要向量，修复pending/attempt3的漏拒并保留先红后绿证据；最终head正式批准、正常合入、main完整门禁及原始制品复核均已完成。因此tasks 1.3据实勾选，交小张按2.x进入实现与自测。

九个操作仍为frozen，原13个current操作及运行迁移目标4不变，000005尚无真实SQL/摘要；本补记不改运行代码、配置、Compose或服务，不提前开放作业页面。小张需实现真实迁移目标5、权限/配额、同事务幂等202/submission/task/outbox、持久租约与三次耗尽/取消CAS，补全部21场景和真实失败阻断证据；生产无执行器时保持pending，不能造批改成功。

实现后交小陈独立终审3.1；真实最终head批准、保护门禁、main业务集成及归档分别完成后再勾3.2/3.3。05真实数据库/并发/租约/崩溃恢复、真实模型/成绩/作业页面均尚未完成；其他暂停变更不因此恢复。本补记已提交[PR #36](https://github.com/zwh9616/campus-claw-plus/pull/36)，来源分支`codex/05-contract-main-acceptance`，实际请求小张评审；自身最终head CI另核，未代其批准本补记。
