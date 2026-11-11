# 04 后端独立终审

2026-11-11，小张（zwh9616，AI辅助）接手[PR #26](https://github.com/zwh9616/campus-claw-plus/pull/26)。作者交接为`873775eb321acaabc676817be82c616d5c5349d9`，基线main为`5a6451ca5a5b313fedf9742f1e20bd3ffb0e10e8`。本机Windows、Node25.2.1/npm11.6.2、Docker29.8.0，Go使用仓库固定摘要的1.27.3容器工具链。本次Docker已实际恢复；小陈此前缺Docker的记录保留为其执行历史。

## 审查与修复

核对领域/HTTP/存储装配、13个current操作、六个资料操作的权限及错误顺序、原文/幂等创建事务、索引回滚与重试、同快照检索/出处、000004实际SQL/摘要/结构校验及离线恢复。01旧SQL、配置/服务和健康合同保持原义，应用仍不自动DDL。

发现创建和索引的`tx.Commit()`错误均直接映射为`UPSTREAM_TIMEOUT`，使非超时连接故障错误返回504。按04 D1和MR-SC-05/07/08，连接故障应503，超时应504。已直接在原PR改用现有`materialError(ctx, err)`，覆盖两个提交出口。

新增`TestMRCommitFailureDistinguishesUnavailableAndTimeout`。所有事务查询写入执行真实可信TLS MySQL，仅在测试连接适配器的Commit响应注入连接错误或deadline，并回滚真实事务。它验证创建/索引均按503与504分类，以及创建失败无资料/重放半写、索引失败不暴露片段；该注入不冒充真实网络断开。

还在默认生产HTTPS接线测试补齐学生真实检索/原文、学生写403、教师切班后原凭证401，以及外班与不存在的完整错误体（剔除request_id）一致。它们随现有持久卷重建和恢复步骤重复执行。

## 本机实际红绿

首次`npm run gate`在加入上述回归测试、运行代码仍为作者版本时，check/audit/secret-scan退出0，四个实际镜像扫描和生产HTTPS/卷重建通过，verify在新回归测试退出1：

- create commit error = UPSTREAM_TIMEOUT，期望DEPENDENCY_UNAVAILABLE。
- index commit error = UPSTREAM_TIMEOUT，期望DEPENDENCY_UNAVAILABLE。
- deadline子例通过，其他原资料回归通过。

修复后本机`npm run gate`退出0，check/audit/secret-scan/verify四段全部0，notRun为空。verify实际耗时204034ms，低于原600000ms门限；新增提交错误的两个子例均通过。四个实际镜像HIGH/CRITICAL均0，默认可信HTTPS学生检索/原文、跨班同构404、旧凭证401、数据库停启及保留卷全重建后的三轮回查均通过；真实MySQL身份/资料、三处DDL中断、索引重试和真实mysqldump隔离恢复及旧制品回归全部0。

实际阶段退出码见[门禁原件](zhang-gate-results-2026-11-11.json)，红绿、制品标识、原始扫描摘要及运行步骤见[复验结果](zhang-review-results-2026-11-11.json)。原始源码日志与扫描JSON留在本机忽略目录`output/`，最终head的完整CI还须独立通过。新增记录不包含测试凭据或正文。

## 交接

3.1独立终审与修复后本机全门禁已完成；3.2还需最终head批准、远端门禁、正常合入与main复验；3.3归档另记。04只交付资料后端，06资料页、作业及AI继续按实际依赖和批准推进。
