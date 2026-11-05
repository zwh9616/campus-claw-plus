## Why

现有 npm 门禁已能检查骨架与合同，但 main 当前没有实际分支保护，绿色 CI 本身不能阻止失败版本合并。00 之后各服务将逐步接入，需要先让失败拦截生效，再分阶段验运行、告警和恢复，避免用部署草案冒充交付。

## What Changes

- A 前置门禁：保留全部 npm 检查，以 Makefile 提供薄封装统一入口，确保失败非零；CI 必跑且由 main 的实际保护要求约束，留受控红绿与合并被阻断证据。
- B 增量接线：各服务依批准的变更及合同逐项加入构建、配置、健康、权限和故障检查；不预建未就绪服务或假健康。
- C 最终验收：同一候选版本验证启停、JSON 日志/指标、告警、隔离恢复与回滚，关联可复现原始证据。
- 明确 G3 只表示 A 已终审、合入 main 并复验；10 整体完成仍须 B/C，不提前通过 G2/G3。

### Non-goals

本 PR 只提规约，不修改代码、CI、保护设置或运行配置；不实现业务、云部署平台或完整监控系统，不产生真实外部通知，不合并任何 PR。

## Capabilities

### New Capabilities
- `delivery-observability`: 分阶段交付门禁、服务接线及最终观测恢复的可验证行为。

### Modified Capabilities

无。沿用 project-bootstrap 的骨架回归与已批准 00 的 G2/G3，不追改历史归档，不提前改变 /health 合同。

## Impact

后续 A 实现预期修改 Makefile、现有 npm/CI 入口及发布文档，需仓库管理员设置 main 保护；B/C 按对应服务就绪程度修改 Compose、探针和观测适配器。新增证据在 reports/changes/10/，状态统一 docs/project-status.md。规约/终审小葛，实现/审规约小陈；G2 和本规约批准前禁止 apply。起草基线 main 2bf12e2；00 规约 221be73 已批准、实现 PR #5 尚未合入 main，引用其受审接口不等于把实现带入本 PR。
