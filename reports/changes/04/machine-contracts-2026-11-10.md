# 04 机器合同和迁移登记候选

执行者：小陈（Kevcco，AI辅助），2026-11-10。分支`codex/04-machine-contracts`，基于main `031c13ffb753832fc6c94b89e29c8021012c574f`。#23规约已由小陈实际审查批准并正常合入；本合同候选由小陈编写，待小张审定，不代填批准。#24只补共享表，已核对后正常合入031c13f，同SHA完整CI42803851784成功。

## 交付与审查点

- 八个2020-12单源Schema：Material、MaterialPage、MaterialDetail、KeywordSearchResponse、MaterialUpload、MaterialListParameters、KeywordSearchParameters、MaterialIdempotencyKey。所有对象封闭并明确必需字段，公共ID/Timestamp/Citation/Error保持原义。
- 六个资料操作在OpenAPI及登记中为frozen候选，七个既有current操作不变；禁止其他planned操作或资料合同误标current。只有Bearer身份，教师写、本班学生只读ready；固定404、no-store、附件/nosniff头、角色/资源判定顺序、输入白名单、按主体限流、同键重放及503/504错误集合均有明确声明。
- 首版仅UTF-8文本和区分大小写的片段内字面keyword；原始字节与规范化正文、码点区间分开。只剥离一个BOM，原始文件若有两个BOM，规范化正文仍可含第二个；不擅自多剥离。跨片段未完整匹配时为空结果，不扩大公共Citation的2000码点。
- 000004在[迁移登记](../../../docs/contracts/migration-register.md)预留，详细[兼容/恢复候选](../../../openspec/changes/2026-11-10-materials-retrieval/migration-plan.md)含只加表、逐DDL中断、结构/摘要核对后的前向修复、旧程序精确版本拒绝及隔离备份恢复。当前没有SQL/真实摘要，没有将预留号标available；不修改01已发布SQL、配置、健康、服务或凭据。

小张需审定：上述六操作的frozen边界、输入/输出与错误；原始UTF-8字节和multipart流式上限的分工；唯一键/原文/索引事务与真实失败场景；000004编号/文件/依赖、前向修复及旧制品回退计划。tasks1.2/1.3保持未完成，审定当前head并满足门禁后才能进入运行实现。

已创建[合同PR #25](https://github.com/zwh9616/campus-claw-plus/pull/25)，合同候选提交`5fd8969c58cc0faf68d6798d82a14c9238011931`；已通过GitHub向小张账号zwh9616正式请求review。本次后续提交仅同步PR与交接文档，机器合同/测试和运行输入不变；最终head的CI和审查以PR实时记录为准，未预填批准或合入。

最终核对补记：检索q的OpenAPI参数显式声明`TrimSpace-before-schema`；引用Schema约束规范化值，不能把合法原始` q `误判为400。合同变异中新增删除该规范化声明即失败，16组用例仍全过；未改变规约的检索语义和运行范围。

## 实际验证

Windows，Node v24.22.1、npm10.5.0、Go1.27.3 windows/amd64，GOTOOLCHAIN=local。本次未新增依赖，原锁文件未变；本机不具备Docker命令，本轮不在本机执行verify。远端当前head完整CI另在PR记录，不能预填成功。

| 命令 / 项目 | 实际结果 |
| --- | --- |
| `npm run check` | 退出0；合同、原身份/前端、构建、Go vet/单元及strict8/8均通过 |
| `npm run check:contracts`（纳入上项） | 共32个Schema；140结构正反例、6个原有语义输入及12个生成边界在独立2020-12/OpenAPI解引用两条路径一致，79个操作示例有效；16组合同/语义测试通过 |
| `npm run audit` | 退出0，根目录/frontend均0漏洞 |
| `npm run secret-scan` | 退出0，全历史及暂存内容均无泄露，没有放宽任何规则 |
| `git diff --check`及范围核对 | 退出0；91个本地链接有效；backend/frontend/deploy/Compose/.env.example/工具链镜像/锁文件相对031c13f无差异，01六个SQL及摘要不变 |
| 当前04真实运行、迁移、DB恢复、跨班副作用 | 未验证：本PR只提供合同及计划，没有04运行实现；既有身份CI成功不充当04运行验收 |

## 故意失败 → 恢复

对候选OpenAPI临时将`POST /api/v1/materials`的security从Bearer改为空数组，执行`node scripts/check-contracts.mjs`，真实退出1，错误为`Material operations must not accept anonymous/Cookie authorization`。finally恢复完全相同的原文件字节后，同命令退出0，再执行完整check通过；失败变异未提交。原始日志在忽略的`output/04-review/contract-red.log`、`contract-green.log`和`contract-red-green.json`，结构化摘要见[证据](machine-contracts-results-2026-11-10.json)。

语义例子验证提供的正文/版本/quote关系、字节和分页边界；合同变异验证声明错误会阻断。它们不执行真实HTTP身份授权、SQL锁/事务、文件流解析或数据库持久化；MR-SC-01..10的运行责任仍按[映射](../../../docs/contracts/acceptance-map.md)与04任务清单逐项实测。原有四个用户未提交文件保留，未纳入提交。
