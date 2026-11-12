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

## 干净源码完整门禁收口

上述待执行门禁现已在干净提交 **4fbc93b94a16b20a335d887e0debf16015a7b32c** 独立完成：check、audit、secret-scan、verify 全0，notRun 为空，verify **138475ms**，保留原600秒上限。四个实际镜像 HIGH/CRITICAL 全0，扫描与运行完整ID一致，四项临时标签清理0；原 HTTPS、健康/探针、数据库停机与重启/容器重建、身份/资料及真实4/5制品/隔离恢复全部通过，新增跨库回归也实际通过。未把生产数据库或05业务状态夹具当作实际部署/worker验收。

[完整原始报告及失败日志](chen-migration-review/final-evidence.zip) · [源码/版本/四段退出码/镜像/清理与源报告摘要](chen-migration-review/final-gate-summary.json)。原 ZIP 在两端 SHA-256 相同，解包原文 Gitleaks 退出0。

环境失败如实保留：扫描工具下载超时、官方漏洞库下载超时、手动提取缺少本地下载登记，以及前端官方 Alpine 软件包下载超时。扫描工具采用原固定摘要核验的官方归档；漏洞库采用仓库预备入口已列出的官方 ECR 源，完整层摘要核验后保存原 UpdatedAt/NextUpdate，仅登记本次真实下载的 DownloadedAt，遵循 [Trivy 官方客户端逻辑](https://github.com/aquasecurity/trivy/blob/main/pkg/db/db.go)。前端使用原 Dockerfile、正常 TLS 和官方包签名完成一次临时转接预构建；最终完整 gate 使用默认 Docker 配置、原镜像/扫描规则与时限，转接及预构建标签已关闭/清理。没有使用跳过扫描、忽略漏洞或修改库构建时间的方式放行。

#39 已获本人对 a8f3d8d 的真实批准5875716251，完整CI43232083005成功后正常合入 **2e4a71b**，主干完整CI43232906682及原 artifact 摘要/四源报告/镜像/清理已独立核验通过。本分支逐块处理进度表冲突，保留 #39 原件与本次05修复；整合后的 **0eabe92** 完整CI43233462275成功，原件另核新增跨库测试与真实4/5恢复均通过。运行输入与上述4fbc93b逐路径一致。

本补记仅增加证据、任务交接和进度，最终补记 head 自身 CI、本人正式批准、正常合入和精确 main 复验以 [#38 的实际记录](https://github.com/zwh9616/campus-claw-plus/pull/38) 为准，不在生成该提交前虚填未来 SHA 或结果。后续审查 #40 的2.2/2.3，05全量2.4/2.5/3.x及作业页面仍另验。
