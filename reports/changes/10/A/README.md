# 10 A 前置门禁交接

执行人：小陈 / Kevcco（AI辅助）。本轮仅DO-01..04及现有骨架回归；不实现B/C、不改变健康/配置合同，不代小葛终审。

## 当前验收结论（2026-11-07）

#9已获小葛对b81d698的真实终审并正常合入main 55f0e83，同SHA完整CI42356275838成功；小陈已核对文件树、required check及保护阻断证据，两位负责人共同登记G3，tasks3.2完成。见[主干集成与共同复核](main-integration-2026-11-07.md)。10 B/C及整体归档仍待办。下文各日期的失败、权限限制与待办是当时快照，保留原义，当前状态以本节为准。

## 2026-11-06保护启用后的进展

小张已实际启用main保护并保存[管理员回读](main-protection-applied-2026-11-06.json)。小陈在[受控测试PR #12](https://github.com/zwh9616/campus-claw-plus/pull/12)补齐缺检查、执行中、真实合同失败、取消及原字节恢复后同SHA完整绿的快照，详见[本轮验收记录](protected-gate-proof-2026-11-06.md)。`check`为required，main protected=true。真实非作者批准及旧批准失效实验仍待完成，tasks2.6未勾；小葛最终终审及受保护main集成仍未完成，G3未成立。以下未保护/PR #10记录是初次执行历史，保留失败及权限限制，现状以本节为准。

## 准入与范围

- 起点main `7e4c81f37473ed725cfe3b1f90ffd32c5049c41c`，其[完整CI](https://github.com/zwh9616/campus-claw-plus/actions/runs/42050569845)成功。
- 00已获[小葛终审](https://github.com/zwh9616/campus-claw-plus/pull/5#pullrequestreview-5782045346)、合入main `4cfd61d`并有[同SHA集成check/verify](https://github.com/zwh9616/campus-claw-plus/blob/29397750f3d6f8879b6aacdacbbe3e7d160ede3c/reports/changes/00/main-integration-2026-11-05.md)，G2成立。
- 10规约[最终批准](https://github.com/zwh9616/campus-claw-plus/pull/7#pullrequestreview-5787031497)绑定`8246bc9`，已合入上述main；允许小陈开始A。
- main保护初始为false，有效规则为空；Kevcco有push，无admin/maintain权限。因此当前G3未成立，不能把代码/CI成功记成保护通过。

## 原检查覆盖对照（DO-SC-03/04）

| 原入口（基线7e4c81f） | A入口 | 保留的检查 / 失败证据 |
| --- | --- | --- |
| npm ci / npm run setup | make setup或原npm命令 | 根及前端锁定安装；任一步失败停止，不纳入已安装后的gate |
| npm run check:foundation | check第一项，未改 | 规则/技能入口、active空值配置、.env忽略、禁止私钥进Git |
| npm run check:contracts | check内原命令未改 | OpenAPI3.1、22单源Schema、82正反例双路径、6语义输入、39接口例及6组语义测试；真实破坏Principal.role枚举验证失败 |
| npm run typecheck / build | check内原命令未改 | TypeScript及Vite真实类型/构建 |
| npm run check:backend | check内脚本未改 | 固定Go1.27.3 vet、shuffle test、build；没有本机Go则固定摘要Docker工具链 |
| npm run check:spec | check内原命令未改 | 锁定OpenSpec全量strict |
| npm run audit | gate第二项 | 根及前端high/critical非零，命令及阈值未改 |
| npm run secret-scan | gate第三项 | 原Gitleaks8.30.1摘要校验、全部历史及暂存、原值隐藏，未改 |
| npm run verify | gate第四项 | 原15项配置/健康/日志/占用/停启断言保留；仅资源隔离与清理改造 |
| CI job check | 稳定check，安装后make gate | Actions固定SHA、contents:read、20分钟、并发取消、所有PR及main push；没有路径过滤或忽略错误 |
| 无编排回归 | check:gate（新增于check） | 真实子进程替身：串行成功、四阶段逐项exit17、ENOENT、信号、超时124、取消130、锁争用、独立资源；不冒称真实合同/容器/保护证据 |

正常入口为`npm ci && npm run setup && npm run gate`，GNU Make等价为`make setup && make gate`。gate只调用既有npm脚本；Make只调用npm。每个阶段有超时，失败立即停止，后续未运行项明确记录。gate结果位于忽略的`output/verification/gate-results.json`；verify结果位于`output/verification/local-results.json`。

同一工作树gate用排他锁拒绝并发；不同目录的verify每次使用UUID项目、独立镜像标签和Docker原子分配端口，仍只监听127.0.0.1。临时Compose由原配置解析得到，保持环境、构建、探针和原服务集合；finally清理自己的容器/网络/镜像标签及临时文件，不清理共享构建缓存或其他项目。

## 当前验证与后续交接

基线main 7e4c81f：锁定安装、原check/audit/secret-scan/verify全部退出0；原15项容器断言通过，[完整原输出](baseline-original-output.txt)保留命令、退出码及输出（工作目录脱敏）。

实现e51a1ba：Node22.23.4 / npm10.9.9 / GNU Make4.3 / Docker28.3.3 / Compose2.39.1，真实`npm run gate`及`make gate`均四阶段退出0，各自15项容器断言通过；[该head CI](https://github.com/zwh9616/campus-claw-plus/actions/runs/42166753398)成功。Windows Node24.22.1首轮12项编排测试通过；本次补Make安装失败/并行调用反例后为13项，Windows缺Make如实记未验证，Linux实际执行将另留证。

后续代码d88bf2d的[CI](https://github.com/zwh9616/campus-claw-plus/actions/runs/42167069861)成功；Linux实际GNU Make边界测试13/13，无skip。该版本真实合同红绿、恢复后的完整gate及两目录并行verify全部通过，见[机器摘要](local-validation.json)。

| 验证 | 实际结果 / 证据 |
| --- | --- |
| 真实合同破坏 | 只删除Principal.role的student枚举值，[受控diff](controlled-contract.patch)，未改检查器或fixture断言；[合同检查退出1](contract-red-output.txt) |
| 破坏后的完整gate | [退出1](gate-red-results.json)，check失败；audit/secret-scan/verify明确未运行，未冒称通过 |
| 逐字节恢复 | [SHA256](contract-hashes.json)原/恢复均为676505632c766161d2aa7b9a0c2e2133e658ab5581f75f0403a2ee117484a234；[完整gate四阶段退出0](restored-gate-results.json)，[原15项容器断言及清理通过](restored-container-results.json) |
| 编排替身 | [13项输出](make-boundaries-output.txt)：四阶段逐项exit17、信号、取消、超时124、缺命令、锁争用、Make安装失败停止及-j8串行；这些是编排测试，不代替上面真实合同/容器 |
| 真实并行容器 | [第一份](parallel-one-results.json)与[第二份](parallel-two-results.json)各15项通过；项目/镜像标签和两个环回临时端口各不相同，两次finally清理通过，验后无残留验收容器 |
| 真实红CI | [测试PR #10](https://github.com/zwh9616/campus-claw-plus/pull/10)红head 0dd593b，[run42167205201失败](https://github.com/zwh9616/campus-claw-plus/actions/runs/42167205201)，[API快照](ci-red.json)为UNSTABLE而非BLOCKED；未发送merge请求 |
| 新head与取消 | 恢复head ecd6c71与d88bf2d源树一致；[新head运行中快照](ci-restored-initial.json)未沿用旧绿；[主动取消快照](ci-cancelled.json)实际为cancelled，不计成功；[同SHA第二次完整CI成功](ci-restored-success.json)，测试PR已关闭且未合并，分支保留 |

本轮没有真实他人批准可用于“旧批准失效”实验，当前也没有有效保护。因此管理员保护、同head BLOCKED、旧批准撤销以及missing/pending/cancelled不能合并的证明仍未通过；tasks2.4/2.6和G3保持待办。没有实际测试missing检查的合并阻断，不能由编排测试推出。

最终实现PR为[PR #9](https://github.com/zwh9616/campus-claw-plus/pull/9)。最终head证据以该PR的检查与交接评论为准；本报告不会预填正在生成的提交SHA，也不将最终文档提交的CI提前记成功。

管理员阻塞：由仓库管理员应用[明确配置](required-main-protection.json)，随后重取实际配置并运行受控测试PR，证明failure/pending/missing/cancelled及旧批准不能合并。建议配置文件本身不是已生效证据。示例（管理员使用自己的登录，不共享令牌）：

```bash
gh api --method PUT repos/zwh9616/campus-claw-plus/branches/main/protection \
  --input reports/changes/10/A/required-main-protection.json
gh api repos/zwh9616/campus-claw-plus/branches/main/protection
gh api repos/zwh9616/campus-claw-plus/rules/branches/main
```

required context为`check`，实际来源GitHub Actions app ID `15368`（从基线check-run `127325247980`读取），不是另创状态名。要求分支最新、PR至少一位非作者批准、更新撤销旧批准、管理员同受约束、无force push/删除/绕过；按新协作规则不额外要求“最后推送者之外的人”批准。

小陈完成实现后交小葛在实际账号下终审/修复。只有保护、受控阻断、终审及main集成完整gate均有真实证据才成立G3；10整体仍需B/C，00独立阅读失败另行修复，不归档本变更。

## 2026-11-07当前结果

[旧批准失效实验及新main同步](stale-review-proof-2026-11-07.md)已完成：真实APPROVED自动DISMISSED，无文件冲突且新head完整CI成功仍BLOCKED，#12关闭未合并；2.6完成。前文“待真实批准/实验未执行”为历史；#9小葛终审和main集成仍待办，G3未成立。
