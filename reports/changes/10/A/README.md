# 10 A 前置门禁交接

执行人：小陈 / Kevcco（AI辅助）。本轮仅DO-01..04及现有骨架回归；不实现B/C、不改变健康/配置合同，不代小葛终审。

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

实现e51a1ba：Node22.23.4 / npm10.9.7 / GNU Make4.3 / Docker28.3.3 / Compose2.39.1，真实`npm run gate`及`make gate`均四阶段退出0，各自15项容器断言通过；[该head CI](https://github.com/zwh9616/campus-claw-plus/actions/runs/42166753398)成功。Windows Node24.22.1首轮12项编排测试通过；本次补Make安装失败/并行调用反例后为13项，Windows缺Make如实记未验证，Linux实际执行将另留证。

独立并行容器、真实合同红绿及最终head完整门禁/CI待继续执行；不得以e51a1ba替代后续head。管理员有效保护、BLOCKED、旧批准撤销以及缺失/取消检查的真实合并阻断仍未通过，不写G3。

管理员阻塞：由仓库管理员应用[明确配置](required-main-protection.json)，随后重取实际配置并运行受控测试PR，证明failure/pending/missing/cancelled及旧批准不能合并。建议配置文件本身不是已生效证据。示例（管理员使用自己的登录，不共享令牌）：

```bash
gh api --method PUT repos/zwh9616/campus-claw-plus/branches/main/protection \
  --input reports/changes/10/A/required-main-protection.json
gh api repos/zwh9616/campus-claw-plus/branches/main/protection
gh api repos/zwh9616/campus-claw-plus/rules/branches/main
```

required context为`check`，实际来源GitHub Actions app ID `15368`（从基线check-run `127325247980`读取），不是另创状态名。要求分支最新、PR至少一位非作者批准、更新撤销旧批准、管理员同受约束、无force push/删除/绕过；按新协作规则不额外要求“最后推送者之外的人”批准。

小陈完成实现后交小葛在实际账号下终审/修复。只有保护、受控阻断、终审及main集成完整gate均有真实证据才成立G3；10整体仍需B/C，00独立阅读失败另行修复，不归档本变更。
