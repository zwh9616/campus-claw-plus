# 10 A旧批准失效实验与新主干同步

执行人：小陈 / Kevcco（AI辅助），2026-11-07；DO-SC-04/06..09。用户恢复此前暂停项后，在原#12隔离测试分支操作；正式实现仍为#9。

## 真实结果

1. [提交前REST](protected-proof/stale-approved-before.json)和[GraphQL](protected-proof/stale-approved-rollup.json)记录01384fa与小张review5799296188的真实APPROVED；旧head完整CI42205527375成功。此前因main更新存在文件冲突，本快照不作为纯审查阻断证据。
2. 受控新提交[9ad6977](https://github.com/zwh9616/campus-claw-plus/commit/9ad69775960d2cd7b12a7fbddfa2250b9307f2ba)合入main3bf34de，逐行保留排班及门禁，新增退出码255真实子进程边界测试。本机14项通过；Windows无GNU Make，真实Make由本次CI执行，不冒称本机通过。
3. 原review自动变DISMISSED；[新head执行中REST](protected-proof/stale-updated-after.json)及[GraphQL](protected-proof/stale-updated-rollup.json)为REVIEW_REQUIRED/BLOCKED。没有调用dismiss API或修改保护。
4. [完整CI42353376907](https://github.com/zwh9616/campus-claw-plus/actions/runs/42353376907)成功后，[同head REST](protected-proof/stale-green-blocked.json)证明mergeable=true无文件冲突，check success且来源app15368；[同head GraphQL](protected-proof/stale-green-rollup.json)证明required=true、SUCCESS、REVIEW_REQUIRED、BLOCKED。由此排除当前CI未完成及文件冲突，旧批准不能放行新head。
5. [#12收尾评论](https://github.com/zwh9616/campus-claw-plus/pull/12#issuecomment-6704213196)后关闭测试PR，[回读state=closed、merged=false](protected-proof/stale-closed.json)，保留分支与证据，未发送merge请求。

[前轮missing/pending/failure/cancelled/恢复证据](protected-gate-proof-2026-11-06.md)保留不改写。本次补齐其旧批准待办，未将小张对实验版本的批准代作#9终审。

## #9同步及校验

将已获小葛批准的#16/main3bf34de合入#9原分支，唯一冲突是共享表。保留暂停扩规约及三人真实登录接力，纠正已发生的#14候选审修及#16集成事实；保留原check:gate/统一CI、identity-phase检查、完整历史扫描和精确公开摘要误报规则。旧报告和失败记录均保留。

Windows Node24.22.1/npm10.5.0/Go1.27.3：本轮npm run check退出0（含编排13项、合同/类型/构建/Go/strict7/7），npm run audit退出0（根/前端0漏洞），diff检查通过。Windows没有Docker，本机容器验收不冒称已执行；正式PR最终完整CI按实际head另记。#12的真实完整CI含Make/容器，但不代替正式#9最终head的检查。

2.6按完整证据完成；3.1小葛最终终审及3.2受保护main合入/集成复验仍待完成，G3未成立，不扩展10 B/C。
