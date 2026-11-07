## Context

G2 已由 main 4cfd61d 的集成复验成立；G3 仍待 10 前置门禁。陈提出 PCR，张已接受内部方案并作为审查者维护公共文件。按新协作规则直接修复，不因审查者写入文件再增加反向审批轮次；真实远端批准与检查仍必须满足。

## Goals / Non-Goals

让 01/02 按确定的公共约定编码。此轮不实现登录或迁移程序，不激活未来配置、不改骨架探针、不输出证书或凭据，不给 planned 教学操作补接口。

## Decisions

### D1 单一运行阶段

`docs/contracts/identity-phase.json` 是阶段/迁移占号登记；current_phase=skeleton，frozen_phase=identity。Health.schema 继续严格空依赖。IdentityHealthUp/Down 是未来类型唯一源；OpenAPI `/health` 的 `x-frozen-identity-profile` 引用这两个类型，当前 responses 仍只有原 200。

01 接入真实 MySQL 的同一受审实现提交，必须同步：current_phase、当前 `/health` responses/Health 引用、服务实现、内置探针、配置 frozen→active、空值样例、Go/HTTP/容器用例、规范和阶段检查器。不能只改 phase 字段；不能用环境开关、anyOf 或失败回退同时容许两套成功载荷。首次整体发布切换，整个制品只有一种健康合同。主干合并仍等 G3。

identity 健康匿名、每请求真实 Ping、独立 3000ms 总预算（不沿用业务 5000ms），200 为 mysql=up/status=ok，503 为 mysql=down/status=error。超时同为 503，保持服务端 X-Request-ID、JSON 日志且无原始错误或连接信息。镜像内探针必须验证精确成功载荷，down/超时退出非零。真实断开/恢复留待 01，合同 fixture 不能代替。

### D2 配置与 HTTPS

七键的用途、安全和超时唯一登记于 config-register.frozen。当前 active/sample 不变。未来按使用进程检查各自所需键，backend 不读取迁移凭据；离线迁移/初始化程序为了核对目标及 TLS 约束可读取业务连接信息但不得输出。HTTP_PORT 原约束不变。数据库连接/读/写 3 秒，业务从首次 DB 操作起共享 5 秒；迁移/初始化锁 10 秒，单条 DDL 30 秒。连接明确失败 503，业务总预算到期/COMMIT 不明 504，后者不重放、不宣称回滚、不签发凭据。健康采用 D1 独立预算。

同源 Nginx `/` 前端、`/api/v1/` 后端，可信 SAN 证书只读挂载，Secure Cookie 和 Origin/CSRF 顺序不变；后端不对非本机地址发布。代理覆盖单一 X-Real-IP，只信登记代理对等端的合法单 IP，其他连接使用直接来源。不得使用不校验证书的验收。MySQL 容器初始化/卷/服务端 TLS 的具体运行输入由 01 接线子包在编码前明确登记；它不阻塞 01 领域单测和 02 mock 样板，但缺失时不能启动或声称真实联验。

### D3 版本、迁移和恢复

精确版本/许可/镜像摘要继续以 01 runtime-plan R1 为登记依据，不升级：MySQL 8.4.13、mysql 驱动 v1.10.1、x/crypto v0.58.0、migrate/v4 v4.20.1；本轮不安装。用途/许可为小张此前已接受的方案，实际拉取、锁文件和依赖扫描在引入时验证。

phase.migrations 保留 000001 users/classes/memberships、000002 sessions/access_credentials、000003 auth_audit，依次依赖。编号不是已执行证据，checksum=null；实际 SQL up/down 名称由编号和 name 组成。01 编写 SQL 时提交真实字节 SHA-256 manifest、前后置结构检查、逐条 DDL 故障点及补偿脚本，不能原地改已发布迁移。dirty、摘要缺失/冲突、成功记录与结构不一致时服务和新迁移失败关闭。MySQL 隐式提交不能靠事务恢复全部 DDL；隔离副本先核对失败位置、保留数据，以经审前向修复后验证结构/摘要/版本再解除 dirty。禁止盲目 force、删库恢复。down 仅隔离空数据测试，实际数据回退按兼容前向修复或已验证备份恢复。初始化在同一 DML 事务，重复输入幂等不覆盖口令、冲突整体回滚；具体输入/哈希沿用 R4/R1。

## Risks / Trade-offs

显式冻结比立即启用多一个阶段，但避免骨架错误宣称数据库已健康。阶段检查器必须在 01 原子激活时受审更新，不能删断言绕过；本次保留现有 7 个 current/frozen 操作和全部门禁。

## Migration Plan

先合入这次公共冻结及 01 规约；后续 01 分支实现并真实联验后切换。没有运行时数据库迁移，不倒改历史 archive。本轮测试报告放 reports/changes/01/public-freeze-2026-11-06.md。

## Open Questions

公共健康载荷、阶段切换、七键、工具及迁移号没有待定项。未执行的真实依赖验证、接线子包输入、SQL 修复脚本是明确后续交付项，不能当成已完成，也不能在未登记时私加运行键。
