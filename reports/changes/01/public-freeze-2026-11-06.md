# 01公共冻结与审查收口（小张，2026-11-06）

来源：小陈PR #6 head72fe59b；整合main14760f5。用户明确要求完成小张工作、测试、同步共享表、提交合并；按2026-11-05审查者直接修复规则扩展原PR，不冒称小葛批准。本次仅公共合同与规约/检查，无身份业务实现。

## 关闭R5的具体改动

- 新增identity-public-contracts四份规约；健康在01引入真实MySQL的同一受审实现提交原子切换，当前骨架不变。
- IdentityHealthUp/Down单源与OpenAPI未来扩展，3秒真实Ping，200/503精确载荷；当前Health拒绝mysql字段。
- 七键进入frozen，使用者、机密、超时/TLS/代理约束齐全，active/sample仍仅HTTP_PORT。
- 000001..000003已保留，未编造SQL摘要或执行；明确dirty/部分DDL/初始化回滚的真实实施交付要求。
- 01四份规约及runtime-plan同步去除已解决待定项，保留历史请求/审查证据。后续接线输入须先登记，真实验收仍未运行。

## 验证

机器记录见[public-freeze-checks.json](public-freeze-checks.json)。ICF-SC-01..05为本轮合同检查；ICF-SC-06的真实DDL恢复仍由01负责。此前已接受的IDF-SC-01..20没有运行实现，不计通过。

| 检查 | 实际结果 |
| --- | --- |
| npm ci / setup | 退出0，按锁安装，无业务依赖新增 |
| check:contracts | 退出0；24 schemas，99正反例+6语义输入，41接口示例；9组测试通过 |
| 受控破坏 | IdentityHealthUp.mysql const从up改down，未改用例/检查器；退出1；finally逐字节恢复，重跑退出0，摘要见JSON |
| typecheck / build | 退出0 |
| check:spec | strict7/7，退出0 |
| audit | 曾返回根/前端0漏洞退出0；记录复跑遇registry TLS断连退出1，待恢复复跑，不把断网当无漏洞 |
| secret-scan | 全历史58 commits及暂存扫描退出0，无命中；最终提交后再核当前范围 |
| 完整check / verify | check在Docker管道不存在处退出1；日志确认sailor-ingest.sock占用；verify待环境恢复，不能冒称通过 |

## 保护与同伴交接

main保护已实际启用，见[API回读](../10/A/main-protection-applied-2026-11-06.json)。#9 76d3d76的CI42199747856成功，保护后API状态blocked。仅此不证明所有失败状态及旧批准失效均通过实验；小陈补受控证据，小葛终审/正常合并/集成。G3保持未成立，不代其批准或合并#9。

02原规约和北大红已入main；本PR冻结合入后小葛可做登录/账号样板和mock，小张实开确认。01实际实现由小张继续，小陈先交DB/TLS接线输入与真实环境子包。详见[共享表](../../../docs/project-status.md)。最终head、CI、批准、合并与集成复验以随后真实结果追加，不预填。
