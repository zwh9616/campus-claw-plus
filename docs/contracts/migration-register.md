# 迁移与共享文件登记

00只分配规则；01现提供内嵌SQL和离线迁移程序。每个部署的实际迁移状态仍须离线check，不能由文件存在推断。

| 项目 | 协调窗口 | 执行办法 |
| --- | --- | --- |
| 数据库迁移编号 | 小张 | 01先确定实际迁移工具；后续迁移采用该工具支持的全局递增序号，开工前在本表登记变更/编号/文件/依赖/兼容和回滚方法，避免并行撞号 |
| frontend与锁文件 | 小葛 | 当前变更两人评审；公共组件/锁文件改动先同步受影响分支 |
| Go装配和公共身份 | 小张 | cmd/server只装配，业务不反向依赖HTTP；公共接口变更列受影响change |
| AI/MCP与Compose/CI | 小陈 | 公共配置和服务接线用小PR，声明版本与依赖；不提前开放候选例外 |

窗口只协调冲突，不是固定技术分工，也不额外增加审批人。每次迁移由对应change的实现人编写、规约人终审；已发布迁移不可原地改写，新增兼容迁移并验证空库/升级/故障回滚。破坏性字段调整先扩展、切读再清理；后续有持久数据后按部署规范备份并恢复演练。

## 实际迁移清单

01候选实现已提供000001..000003及上下行SQL，见[迁移操作说明](../identity-migrations.md)和backend/internal/migrations/manifest.json的真实SHA-256。已在隔离MySQL验证空库/升级/六处DDL中断及恢复，不代表生产已迁移。两位负责人仍为小陈/小张；其他变更不得占用这些号。

## 01号码及候选SQL（尚未部署）

唯一机器登记见 [identity-phase.json](identity-phase.json)。000001 identity_users_classes 建用户/班级/成员，000002 identity_sessions 建会话/凭证且依赖000001，000003 identity_auth_audit 建审计且依赖前两步；负责人小陈/小张。文件名为 `<编号>_<名称>.up.sql` 与 `.down.sql`，其他变更从000004协调申请，不复用这三个号。

工具/许可/镜像来源见 [01 runtime-plan R1](../../openspec/changes/archive/2026-11-04-identity-foundation/runtime-plan.md)，恢复规则见 [公共设计D3](../../openspec/changes/2026-11-06-identity-public-contracts/design.md)。SQL实现时提供真实SHA-256 manifest、逐条DDL故障点、前后置检查及可执行前向修复脚本；dirty/摘要或结构不一致阻止服务和新迁移。MySQL部分DDL不能当事务已回滚，禁止盲目force或删库。实际SQL与摘要见上述候选实现，执行证据见reports/changes/01/implementation-container-results.json。公共identity-phase已切为identity/available并绑定真实上下行摘要；available表示代码可执行，不声称任一持有人数据库已经迁移。

## 04实现候选（方案已审定，实际验收见共享表）

| 变更 / 负责人 | 预留编号和计划文件 | 依赖与兼容 | 恢复与当前状态 |
| --- | --- | --- | --- |
| 04 / 小张终审、小陈实现 | `000004_materials_retrieval`；已新增 `backend/internal/migrations/sql/000004_materials_retrieval.up.sql` 和 `.down.sql` | 依赖干净000001..000003，只加资料、幂等和片段表；01旧SQL及摘要不改；本候选精确要求4，旧版要求3，不能直接接4 | [方案](../../openspec/changes/archive/2026-11-10-materials-retrieval/migration-plan.md)已审定；真实SHA-256已在manifest和identity-phase登记available，仅表示可执行代码。新增逐DDL中断、结构漂移阻断、真实mysqldump隔离恢复和旧制品测试，执行结果及终审仍看共享表 |

01的identity-phase运行阶段、配置、健康和三条已发布迁移不变。04在同一实现候选中扩充既有迁移清单/检查，运行目标4；不让旧程序忽略更高版本，不将代码available当作任一数据库已升级。

## 05迁移基础已验收（available不等于已部署）

| 变更 / 负责人 | 候选号与计划文件 | 依赖与兼容 | 恢复与当前状态 |
| --- | --- | --- | --- |
| 05 / 小陈起草终审、小张审查实现 | `000005_assignment_tasks`；已追加上下行SQL，真实SHA-256见manifest/identity-phase；#35合同审定合入e617cc0 | 依赖干净000004，仅追加assignments/submissions/tasks/task_outbox/submission_idempotency五表；admin/server共用精确Target=5，旧SQL不改；后续#40已启用九业务操作为current | #38经小陈独立真实复测、修复跨库FK漏拒并批准后正常合入fc5c235，精确主干CI43239351413成功；后续#40/#41也已获审合入，main d06198d完整CI43362518043通过。五DDL/结构漂移、实际4/5制品及隔离恢复4证据见[归档核对](../../reports/changes/05/archive-review-2026-11-13.md)。未升级持有人库或做其生产回退。幂等原键VARBINARY避免尾空格/case折叠；复合FK绑定提交原班级/版本/学生及任务回执，不自动清理快照 |
