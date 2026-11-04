# 00 apply：小张实现与自检

日期：2026-11-04。小张明确授权AI复审并继续apply。依据小葛规约head `221be733194830daa9b35f810c37f035679e51bb`及[实际G1批准](zhang-spec-rereview.md)。实现分支`codex/apply-business-contracts`，整合基线`412cde3`；下述检查针对该基线上的本提交工作树，最终提交由Git历史定位，不能将基线SHA冒称本次产物SHA。

## 已落实的范围

- 22个2020-12 Schema，OpenAPI3.1只引用单一类型源；7个操作中仅health为current，6个认证/me操作为frozen；其他操作只登记planned。
- 82个结构正反例及6个语义输入同时经独立Schema和OpenAPI解引用校验；39个操作示例校验；6组语义/边界测试覆盖评分、出处、流终结、配置、MCP例外和planned隔离。
- 原`npm run check`加入`check:contracts`，保留基础、类型、构建、Go、规约各阶段及失败阻断。工具精确锁版本，Node最低22.19.0。
- AGENTS、五类规范、两项campus技能、配置登记及foundation同步；当前.env.example仍只有空HTTP_PORT，MCP例外仍禁用；[迁移对照](../../../docs/contracts/rule-alignment.md)逐项列出证据。
- 共享台账保持16个变更和逐变更两人分工。任务1.5将真实PR复审和仍待完成的新会话证据分开呈现，未减少归档要求。

未修改frontend、backend、Compose、.env.example、历史archive或docs/lesson-07；与221be73比较这些路径无差异。本轮没有认证/数据库/任务/模型运行实现。Cookie传输名`campus_refresh`、明确的Page<Audit>实例是本实现的具体落地选择，须由小葛在实现终审核对；不提前生成Material/Grade占位类型。

## 本机验证

环境：Windows / PowerShell，Node v25.2.1。Go需现有Docker工具链；本机没有可用Go1.27.3。下面通过与失败分别记录，不能合并为“全部通过”。

| 命令 / 检查 | 实际结果 |
| --- | --- |
| `npm ci` | 退出0；安装根锁定依赖96包，审计97包，无漏洞 |
| `npm run setup` | 退出0；前端29包，审计30包，无漏洞 |
| `npm run check:contracts` | 退出0；22 Schema、82正反例、6语义输入、39操作示例、6组测试通过 |
| `npm run check` | **退出1**；foundation、contracts、typecheck、build通过，check:backend因Docker Linux引擎不可用失败；其后的check:spec被正常短路，未绕过门禁 |
| `npm run check:spec`（单独执行） | 退出0；2 passed / 0 failed |
| `npm run audit` | 退出0；根与前端均0 vulnerabilities，保留high阈值 |
| `npm run verify` | **退出1**；仅SC-09缺失配置拒绝通过；Docker引擎不可用，容器构建/健康/日志/停启未验；finally清理也无法连接，不能引用旧output报告冒充新结果 |
| `npm run secret-scan` | 退出0；Gitleaks8.30.1扫描全部19个Git历史提交及本次暂存内容，无泄漏（原值全量隐藏） |
| `git diff --check` | 退出0；换行提示非内容错误 |

最终脚本的check及独立spec原始输出见[local-check-results.json](local-check-results.json)。本机Docker Desktop日志定位为内部`sailor-ingest.sock`监听冲突，Linux引擎未创建；尝试启动、正常退出及一次结束本次故障进程后重启，仍失败。未重置Docker数据、删除镜像或停其他项目容器。该环境故障使本机完整验收保持阻塞，不是合同测试通过后可以豁免的项。远端CI结果须独立记录，不冒充本机成功。

## 受控破坏与恢复

[contract-red-green.json](contract-red-green.json)保存真实命令、输出、退出码与原文件/恢复文件SHA256：临时删去Principal.role枚举，`npm run check:contracts`因非法角色样例被错误接受而退出1；finally逐字节恢复原文件，原/恢复摘要一致，再跑退出0。未删改失败断言。该证据证明本地合同门禁能阻断，不能据此宣称10的远端G3已完成。

## 七类AI核查

| 类别 | 00本轮结论与手段 | 下游仍须实测 |
| --- | --- | --- |
| 接口入口 | current/frozen/planned边界与独立允许清单，刷新Cookie/CSRF/Origin组合及logout无body检查；planned误入反例失败 | 01逐路由认证与HTTP传输上限、重复JSON键 |
| 业务逻辑 | 评分可信rubric、分项/总分/版本边界、SSE顺序与终结用例；无业务处理器 | 05/08事务/幂等/epoch；07A真实连接/模型 |
| 数据库 | 不适用本轮运行，无DB、迁移或SQL；D5写入条件和迁移编号协调保留 | 01/05/08真实DB数量、回滚、并发与查询检查 |
| 公共函数 | 配置、operation、评分、出处、SSE、MCP候选校验，正常/失败/边界共6组测试；结构与语义分开 | 新公共函数继续同样测试 |
| 错误处理 | 错误封闭对象、NOT_FOUND一致消息、TURN_EXISTS专用details、Usage未知值和取消终结；门禁故障非零 | 01/04/05/07/10实际失败副作用、日志与清理 |
| 安全 | 无真实凭据；配置值拒绝、候选出站未启用、引用禁HTTP且不得越合同目录；依赖审计通过 | 01/03/07C/11授权、SSRF、注入和审计实际反例 |
| 性能 | 本轮仅有限fixture/构建检查，无业务P95结果；既定工具次数/时间/上下文上限保留 | 10/12同环境压测、运行资源及恢复 |

## 交接与未完成项

当前仍为“实现与自测”，本机完整门禁失败，先提交可审查草稿，不能标已完成/归档。

1. 恢复本机Docker后，重跑`npm run check`与`npm run verify`，补实际输出。此前CI即便成功也只能作为CI环境结果。
2. BC-SC-01用真实无历史会话，仅输入仓库和change名，保存真实输入输出；当前会话不能代替。
3. 小葛在实现PR当前head终审合同、规则迁移、红绿和以上限制；不能由小张/AI代填批准。
4. 遵守远端门禁合入main，记录集成SHA并复验后才成立G2。10前置门禁成立后才有G3。下游可起草，未达到自身前置不可apply。

验收场景逐项映射见[acceptance-map](../../../docs/contracts/acceptance-map.md)，共享状态以[project-status](../../../docs/project-status.md)为准。
