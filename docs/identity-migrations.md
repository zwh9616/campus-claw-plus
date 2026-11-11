# 01 离线迁移和初始化操作

本入口随01提供，默认Compose已接入可信MySQL/HTTPS。04候选新增000004，离线migrate/check/initialize和server目标均为4；已有部署先停止写入并备份，再升级。01运行依据保留，04新增规则见[迁移计划](../openspec/changes/archive/2026-11-10-materials-retrieval/migration-plan.md)；实际终审及执行结果见共享表。

离线程序通过环境读取已冻结的MYSQL_DSN、MYSQL_MIGRATION_DSN、MYSQL_CA_FILE。两个DSN必须同TCP目标/数据库、不同非root账号、验证CA及主机名；应用账号仅DML，离线账号具备该库最小DDL权限。真实值不写命令行、仓库或日志。服务进程不读取迁移账号。

构建 `go build -o <本机输出路径>/identity-admin ./cmd/identity-admin`（工作目录backend）。实际支持：

```text
identity-admin migrate
identity-admin check
identity-admin initialize
identity-admin repair 1
identity-admin repair 2
identity-admin repair 3
identity-admin repair 4
```

initialize从标准输入读取01 runtime-plan R4定义的严格JSON（classes/users）。通过安全输入工具送入stdin，不把含真实口令的文本直接写进shell历史。新口令12..128 Unicode码点；再次输入同账号不会覆盖密码，角色或班级不一致会冲突回滚。命令失败非零，输出不含原始SQL错误、连接串或密码。

## 四步迁移

| 编号 | 按顺序执行的DDL | 已有数据及恢复 |
| --- | --- | --- |
| 000001 | users → classes → class_memberships | 不插入用户；中断后检查已存在表，补缺表，不删已有表 |
| 000002 | sessions → access_credentials | 保留users/classes；中断时不签发凭证，补缺表和检查结构 |
| 000003 | auth_audit | 缺失或结构不符时阻断启动；补齐后核对索引/历史 |
| 000004 | materials → material_idempotency → material_chunks | 只新增资料表；逐条DDL中断后先核对所有已存在对象，再补缺表并核对历史和结构；不能覆盖漂移对象 |

SQL在backend/internal/migrations/sql，字节摘要在manifest.json。编号和上下行文件一一对应，已发布SQL不可改写。`check`只读，不自动建表；dirty、缺摘要、错摘要或结构不符均失败。

## 发生中断后

1. 停本项目写入入口并做好数据库备份。记录schema_migrations的version/dirty、identity_migration_checksums及实际结构；不要输出凭据或用户内容。
2. 核对manifest对应编号，按上表判断断点。`repair N`只针对当前数据库版本N，先要求之前版本历史完整；当前摘要如果存在必须精确一致。
3. `repair N`重试该步仅增加表的DDL；已存在表不会被删除或覆盖。结构/排序规则/默认值/索引/外键不符会继续失败，dirty不会被盲目清除。此时先审明结构差异和有数据的修复方案，不能直接执行force或删库。
4. 只有实际结构和历史一致才记录缺失摘要并清除dirty，然后执行`migrate`完成后续步，`check`全部通过后才恢复服务。COMMIT结果不明也先查事实，不自动重复写入。

down SQL仅由测试在已断言没有任何身份数据的专用空库执行；正式CLI不提供down或force。带数据版本回退需要已验证备份/兼容方案，不能拿DROP当恢复。

本机可执行 `npm run verify:identity`。它创建自己的临时容器/网络，验证真实MySQL8.4.13、可信TLS、01六个与04三个DDL断点、初始化回滚、会话竞争及资料授权/事务/索引。另从已验收提交构建真实旧制品，在隔离库执行一致mysqldump、恢复版本3并验证五个账号，证明旧程序拒绝升级后的版本4、可运行恢复后的版本3。备份内容和凭据不写日志；最后清理本次资源。该隔离演练不等于生产切换或零数据损失承诺，升级后库保留，切回恢复点会丢失后续写入。生成的测试CA不安装到系统信任库；生产可信HTTPS与卷持久化仍由完整verify验证。
