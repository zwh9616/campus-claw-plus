# 04 资料与本班知识检索归档核对

2026-11-11，小陈（Kevcco，AI辅助）从已合入实现的 main `6634e5128a59c4ac9d6e4443e67bb39ee43cc09c` 准备归档候选，按 #27 的最新交接交小张核对。归档 PR 的批准、完整 CI、正常合入及合入后检查另按实际结果记录；本文件不表示主干已归档。

## 实现终审与主干集成

[#26](https://github.com/zwh9616/campus-claw-plus/pull/26) 最终 head 为 `2bb6dc085d8555a84eef82800525b40cf55a8434`，小张实际批准 `5855812845` 绑定该 head，随后正常合入 `6634e51`。本次通过 GitHub REST 回读并以 Git 比较确认获批树与合入树一致。PR 完整 CI `42986451106` 与主干完整 CI `42987148688` 均成功；小张的本机独立终审及真实提交错误红绿保留原义，没有改记为小陈本机复测。[最终批准](https://github.com/zwh9616/campus-claw-plus/pull/26#pullrequestreview-5855812845) · [小张收口](https://github.com/zwh9616/campus-claw-plus/pull/26#issuecomment-6791071463) · [主干 CI](https://github.com/zwh9616/campus-claw-plus/actions/runs/42987148688) · [独立终审](backend/zhang-review-2026-11-11.md) · [事实快照](archive/github-facts.json)

下载并回读主干 artifact `13839499042`，保留未经改写的 ZIP 和门禁 JSON。check、audit、secret-scan、verify 四段退出 0、notRun 为空，verify 实际 156275ms。backend/admin/frontend/mysql 四份真实扫描均识别制品且 HIGH/CRITICAL 为 0。真实 MySQL 身份/资料、三处 DDL 中断与前向修复、隔离备份恢复及旧制品、默认可信 HTTPS、数据库停启和保留卷重建回归均通过；身份测试没有 SKIP。[原始 artifact](archive/main-ci-evidence.zip) · [原始门禁](archive/main-gate-results.json) · [回读摘要](archive/main-ci-summary.json)

| 场景 | 验收依据 |
| --- | --- |
| MR-SC-01/02 | 双班师生、同班两学生、列表/正文/原字节下载；匿名和旧凭证 401、学生写 403、跨班与不存在同构 404；默认生产 HTTPS 再验学生检索、原文及切班失效。实现自测、独立终审与主干原件分别留存。 |
| MR-SC-03/04 | 同一读快照计数/分页、并发写入边界、未知/重复/非法输入；UTF-8/BOM/CRLF、原始文件及总流上限、控制字符与跨源拒绝。 |
| MR-SC-05/06 | 真实并发同键唯一、异载荷 409、跨班键隔离、创建注错无半写；提交连接故障 503 与 deadline 504；共享主体限流、第 13 次及切班不重置。 |
| MR-SC-07/08 | 半索引回滚、进程退出 pending、并发重试唯一片段；空库及 3→4、三条 DDL 中断/dirty 阻断/前向修复、摘要和结构漂移阻断；实际容器卷重建、DB 故障恢复、真实 mysqldump 隔离恢复及旧制品拒绝 4/恢复 3。 |
| MR-SC-09/10 | 中文/非 BMP、大小写和字面 `%/_`、2000/200 片段与跨片段空结果、同快照出处/原文码点回查；外班与空命中、非法模式和损坏片段 503。 |

详细用例映射见[实现记录](backend/implementation.md)，独立终审修复和复验见[小张记录](backend/zhang-review-2026-11-11.md)。保留作者本机缺 Docker 的失败、首次红测和历史候选 CI，不能用最终通过改写先前执行事实。

## 归档候选范围

执行锁定 OpenSpec 1.13.0 的 `archive 2026-11-10-materials-retrieval --yes`，退出 0，生成 4 项主规约需求并移动完整变更目录。3.2 据真实集成证据补勾，3.3 表示归档候选已生成，仍待小张核对及正常合入。归档 spec 与主规约的 4 项需求、10 个场景正文保持一致；补充 Purpose 和归档设计链接，现行 Markdown、端点登记、OpenAPI 的变更来源及严格匹配断言同步新路径。[资料主规约](../../../openspec/specs/materials-retrieval/spec.md) · [04 归档候选](../../../openspec/changes/archive/2026-11-10-materials-retrieval/) · [任务](../../../openspec/changes/archive/2026-11-10-materials-retrieval/tasks.md)

本次不修改运行接口、SQL、镜像、配置值或检查强度。现有数据库 3 仍须先停写、备份并离线升级到 4；旧应用不能直连 4，生产回退切换和长期部署未执行。资料页面仅在 #27 提出规约候选，作业、模型及 vector/hybrid 等按后续变更验收。00 独立阅读和 10 B/C 不计入本次完成。

## 本次归档校验

本机 Windows，Node 24.22.1、npm 10.5.0、Go 1.27.3。`npm ci`、`npm run setup`、`npm run check`、`npm run audit` 均退出 0，OpenSpec strict 为 8/8，根与前端依赖均 0 漏洞。归档命令退出 0，4 项需求/10 个场景正文一致、149 个本地链接有效；运行输入及旧归档逐项比较一致，合同及其断言只迁移来源路径，未放宽校验。[一致性核对](archive/archive-consistency.json)

完整历史/暂存秘密扫描退出 0（131 个历史提交及本次暂存差异），差异检查通过。本机 `npm run verify` 因 Docker 命令不可用，在漏洞库准备阶段报 ENOENT 并退出 1，镜像扫描及容器验收未运行；失败原件保留在本机忽略目录 `output/04-archive-verify.txt`。归档候选仍需自己的完整远端 CI，不沿用实现版本的 CI 代替。
