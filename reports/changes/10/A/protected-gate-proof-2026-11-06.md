# 10 A实际保护与受控阻断

2026-11-06，小陈（Kevcco，AI辅助）在独立工作树、分支codex/10-protected-gate-proof执行DO-SC-06..09；正式实现仍为PR #9。本轮[测试PR #12](https://github.com/zwh9616/campus-claw-plus/pull/12)禁止合并，基线76d3d76，目标main14760f5。没有修改main保护、编造检查结果或发送merge请求。

## 保护来源与权限

小张已在[管理员交接](https://github.com/zwh9616/campus-claw-plus/pull/9#issuecomment-6682703513)说明设置与回读，原始[保护响应](main-protection-applied-2026-11-06.json)从PR #6的f50dc87原样保留。strict要求最新分支、required check为check且来源app15368、至少1批准、更新撤销旧批准、管理员同受约束、无强推/删除；require_last_push_approval=false保留两人协作约定。

本轮Kevcco实际权限为WRITE，非admin/maintain；branches/main返回protected=true。此账号读取管理级protection端点得到404，GraphQL保护规则列表不可见，因此不把“读不到”当作保护为空。PR的GraphQL仍实际返回check.isRequired=true及同head的BLOCKED。申请JSON去掉与checks冲突的contexts字段和个人仓库不接受的bypass_pull_request_allowances，保留保护要求，未重新提交设置。

## 实验记录

| 状态 | 实际head / 检查 | 结果 |
| --- | --- | --- |
| 完整绿基线 | f1b6f486c56bb27709869cfbf4d5f0a89dfd0dce，[CI42204969373](https://github.com/zwh9616/campus-claw-plus/actions/runs/42204969373) | check success，isRequired=true；仍因真实批准缺失而BLOCKED |
| 当前head缺检查 | 6bc5b1883615be03de24c7095ff86c9489e851eb | 仅此禁止合并测试提交带skip指令，checks/runs均为空，rollup=null，BLOCKED；旧绿未替代当前head。正式工作流未改，原检查全部保留 |
| pending | fb8240c1f2807c468d3010c1bfe49cae149fa32e | check真实in_progress且conclusion=null，同head BLOCKED |
| 真实失败 | 同一fb8240c，[CI42205371741](https://github.com/zwh9616/campus-claw-plus/actions/runs/42205371741) | 只删除Principal.role的student枚举，原正例断言报错；gate check退出1，后续audit/scan/verify明确未运行，Make/CI非零；check FAILURE、isRequired=true、BLOCKED |
| 恢复、取消与同SHA重跑 | 01384fa76a99ffc4319f6f424af39e3fccdf8425，[CI42205527375](https://github.com/zwh9616/campus-claw-plus/actions/runs/42205527375) | Schema按原字节恢复；attempt1实际CANCELLED，isRequired=true、BLOCKED；同SHA attempt2完整gate成功，check SUCCESS，但真实批准未到仍REVIEW_REQUIRED、BLOCKED |
| 旧批准失效 | 待真实非作者批准测试版本后再推送受控提交 | 尚未执行；不以配置声明或其他成员的COMMENT替代真实APPROVED→DISMISSED证据 |

每个BLOCKED观察也同时缺少真实批准，不能单凭一个总状态断言已经排除所有其他阻塞因素。证据分别保留检查结论、isRequired、reviewDecision及合并状态，未通过真正合并请求探测规则。缺检查的skip指令只用于验证门禁故障，不进入正式工作流或实现PR的提交说明。

## 可复核证据

- 基线：[REST快照](protected-proof/baseline-green.json)、[required/合并状态](protected-proof/baseline-rollup.json)。
- 当前head没有检查：[REST快照](protected-proof/missing-check.json)、[rollup=null](protected-proof/missing-rollup.json)。
- 执行中：[pending快照](protected-proof/pending-check.json)；仅此时抓到的状态作为pending证据，不把随后失败的响应改标pending。
- 真实失败：[受控差异](protected-proof/controlled-contract.patch)、[原断言及退出码](protected-proof/failed-contract-excerpt.txt)、[REST快照](protected-proof/failed-check.json)、[required/合并状态](protected-proof/failed-rollup.json)。
- 取消：[恢复后执行中](protected-proof/restored-pending.json)、[取消完成](protected-proof/cancelled-check.json)、[required/合并状态](protected-proof/cancelled-rollup.json)。
- 同SHA恢复成功：[完整CI快照](protected-proof/restored-green.json)、[required/审查状态](protected-proof/restored-rollup.json)、[原文件/恢复文件SHA256](protected-proof/restoration.json)。恢复后Principal.schema.json和工作流均与76d3d76无差异，只有实验记录和对应进度变化。

## 本轮本机校验与交接

Windows，Node24.22.1/npm10.5.0。`npm run check`退出1：foundation、编排测试（13项）、合同检查（22 Schema及6组语义测试）、类型和构建通过，在后端工具链启动处因Docker不可用失败；本机Go/容器未验证。GNU Make不可用，真实Make执行未验证，不能由13项测试汇总推成已执行。另行`npm run check:spec`退出0（5/5），`npm run audit`退出0（根及前端0漏洞）。`npm run verify`因本机缺.env退出1，未进入容器验收。完整容器通过来自上述真实CI，不冒称本机通过。原始本机输出留在忽略的output/verification/protected-proof-*.txt。

本次新增证据JSON解析、各head/检查状态及同SHA重跑对应关系、申请保护字段与管理员回读对照、恢复摘要和36个本地链接检查均通过，`git diff --check`通过；不从这些文件检查推出旧批准实验成功。提交前另查全部Git历史及暂存内容的秘密扫描，最终head CI以实现PR为准。

已请用户安排小葛或小张以自己的账号审查并批准恢复head01384fa，暂不合并；批准到达后再推受控更新，读取真实APPROVED→DISMISSED。尚未收到批准，不填另一成员结论。tasks2.6在该实验完成前不勾；小葛对实现PR最终head终审、受保护main合入与集成复验仍待完成，G3未成立，B/C未开始。
