# 05 首批迁移：小陈独立审查

小陈 / Kevcco（AI辅助），2026-11-12，审查 #38 的迁移基础；来源 head 7878164，仅覆盖 tasks 2.1 / AT-SC-20/21。

## 缺陷及修复

新增真实 MySQL 用例 `TestATMigrationRejectsForeignDatabase`：在独立数据库建立同名 `tasks` 表，将 `task_outbox.fk_outbox_task` 指向该表，保持约束名、列、索引和 RESTRICT 行为。原实现只核对表名和列，`Check(5)`、`Repair(5)` 都接受该漂移；dirty 修复也错误清除了标记。

在原 PR 分支增加 `REFERENCED_TABLE_SCHEMA` 检查，所有五张新表的外键均须引用本库。用例覆盖干净检查、显式修复、dirty 修复拒绝并保留标记，以及恢复本库外键后修复/检查成功。未修改已发布 SQL/manifest，也未新增配置或服务。

## 实际验证

Docker 测试环境 Node 22.23.4、Docker 28.3.3、Compose 2.39.1，使用仓库固定 Go 镜像；本机完整 check 使用 Node 24.22.1、npm 10.5.0、Go 1.27.3。

- 初次用例夹具因 MySQL 同一 ALTER 删除/重加同名外键返回1826，保留失败；拆分为两条 ALTER 后才进行有效实验。
- 原 7878164 + 新用例运行 `npm run verify:identity` 退出1，明确报告跨库检查/修复漏拒和 dirty 被清除。此为真实缺陷实验，不计环境/夹具失败为有效红灯。
- 修复后相同命令退出0；新增用例及原空库/4→5、五处 DDL 中断、显式修复、结构/历史漂移、DML/DDL 隔离和身份/资料回归通过。真实 mysqldump 恢复独立4库，实际旧/新4/5制品拒绝矩阵、五账号及资料原字节复验通过，升级5库在该演练中保留，随后只清理本次可丢弃夹具。
- 本机修复后 `npm run check`、`npm run audit` 均0。原失败、红灯及绿灯完整原件见[原始记录](chen-migration-review/raw-evidence.zip)，[来源与摘要](chen-migration-review/facts.json)。

最终已提交干净源码仍需执行原完整 gate、四制品扫描及本次 head CI，再作本人 GitHub 批准/正常合入与 main 复验；未执行不预填。九个业务操作仍 frozen，2.2—2.5、3.x、worker/AI/作业页面不因此完成。既有持有人数据库未在本次测试中升级，长期部署/生产恢复另验。
