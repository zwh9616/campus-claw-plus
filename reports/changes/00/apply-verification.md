# 00 apply：小张实现与自检

最新状态：小葛已对75cadbf终审批准，00待main集成验收；本机check/verify仍绑定18c3d08。下文保留历史失败/交接快照，当前事实见末节及day-two-review-handoff.md。

日期：2026-11-04。小张明确授权AI复审并继续apply。依据小葛规约head `221be733194830daa9b35f810c37f035679e51bb`及[实际G1批准](zhang-spec-rereview.md)。实现分支`codex/apply-business-contracts`，整合基线`412cde3`；下述检查针对该基线上的本提交工作树，最终提交由Git历史定位，不能将基线SHA冒称本次产物SHA。

## 已落实的范围

- 22个2020-12 Schema，OpenAPI3.1只引用单一类型源；7个操作中仅health为current，6个认证/me操作为frozen；其他操作只登记planned。
- 82个结构正反例及6个语义输入同时经独立Schema和OpenAPI解引用校验；39个操作示例校验；6组语义/边界测试覆盖评分、出处、流终结、配置、MCP例外和planned隔离。
- 原`npm run check`加入`check:contracts`，保留基础、类型、构建、Go、规约各阶段及失败阻断。工具精确锁版本，Node最低22.19.0。
- AGENTS、五类规范、两项campus技能、配置登记及foundation同步；当前.env.example仍只有空HTTP_PORT，MCP例外仍禁用；[迁移对照](../../../docs/contracts/rule-alignment.md)逐项列出证据。
- 共享台账保持16个变更和逐变更两人分工。任务1.5将真实PR复审和仍待完成的新会话证据分开呈现，未减少归档要求。

未修改frontend、backend、Compose、.env.example、历史archive或docs/lesson-07；与221be73比较这些路径无差异。本轮没有认证/数据库/任务/模型运行实现。Cookie传输名`campus_refresh`、明确的Page<Audit>实例是本实现的具体落地选择，须由小葛在实现终审核对；不提前生成Material/Grade占位类型。

## 首次本机验证（历史失败保留）

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

当前为“待终审”：18c3d08的本机check/verify已通过，原Docker阻塞解除。尚未通过小葛终审，不标已完成/归档。

1. 本机check/verify已补齐，见下节恢复记录；保留此前失败和独立CI结果，未混用环境。
2. BC-SC-01用真实无历史会话，仅输入仓库和change名，保存真实输入输出；当前会话不能代替。
3. 小葛在实现PR当前head终审合同、规则迁移、红绿和以上限制；不能由小张/AI代填批准。
4. 遵守远端门禁合入main，记录集成SHA并复验后才成立G2。10前置门禁成立后才有G3。下游可起草，未达到自身前置不可apply。

验收场景逐项映射见[acceptance-map](../../../docs/contracts/acceptance-map.md)，共享状态以[project-status](../../../docs/project-status.md)为准。

交接：实现提交`9e65f77b5eac18c263072bd418a35bc3b643cdd0`已推送并创建[草稿PR #5](https://github.com/zwh9616/campus-claw-plus/pull/5)，目标为小葛规约分支，仅承载00自身；尚未合并main。提交`2af97777d525c7fbb041a08919b34e08cac1303c`的CI已通过，见下节；本机失败记录保持不变。

## 2026-11-04 16:30后续诊断与CI结果

GitHub Actions运行[41798776552](https://github.com/zwh9616/campus-claw-plus/actions/runs/41798776552)，关联head `2af97777d525c7fbb041a08919b34e08cac1303c`，job `126469560617`为success；安装、check、audit、secret-scan及真实容器/进程退出码验收步骤均success。此为CI环境结果，本机Docker失败仍保留，不据此成立G2。

本机Docker Desktop版本4.92.0.240144。用户贴出同一Ingest启动错误后，只读检查确认Desktop/backend均已退出，run目录为普通目录，内部14个零字节`.stale`对象。将该临时目录保留改名为`run-preserved-20261104-163035`并新建run，尝试一次启动；仍失败，错误变为创建run时已存在/监听路径找不到，Linux引擎未创建。结束此次启动的故障进程，确认全部退出且run原位置已空，再将保留目录恢复原名；恢复成功，没有删除原文件。

未更改镜像、容器、卷、WSL磁盘、设置或仓库运行代码；未进行factory reset、数据清理或Windows重启。原目录已恢复，当前建议用户保存工作后重启Windows，再打开Docker并检查`docker info`；这只是下一步恢复尝试，不保证解决。若引擎就绪，继续补跑本机check/verify并登记真实结果。

类似问题存在[Docker用户报告](https://github.com/docker/desktop-feedback/issues/675)，但该报告的rename失败不同于本机初始bind失败，不能认定同一根因。此次观察不足以确认残留socket、Windows状态或Docker缺陷中的具体原因。

## 2026-11-04 重启后本机验收通过

验证提交：`18c3d08dedd78c36e7ceaf9e81c5b2870ebe53cd`；开始时Git工作树干净，本次只新增证据与状态文档，运行代码、锁文件和验收断言未修改。Windows/Node v25.2.1，Docker Server 29.8.0恢复可用。原npm ci/setup/audit和合同红绿已在相同代码/依赖版本执行通过，本次补跑受环境阻塞的完整入口；不是独立会话或小葛终审。

- `npm run check`退出0：foundation、22 Schema/82正反例/6语义输入/39操作示例/6组测试、前端类型/构建、固定Go1.27.3容器工具链vet/test/build、OpenSpec严格2项全部通过。
- 首次`npm run verify`退出1：两镜像构建成功，但默认地址池耗尽，不能创建验收网络；失败输出保留在[local-recovery-results.json](local-recovery-results.json)。
- 只清理`campus-claw-plus_default`：事前核实标签属于本项目、没有连接端点、本项目无运行容器（旧两个容器已停止六天）。未清理其他网络，未删除容器、镜像、卷或调整Docker全局配置。Compose正常启动时可重建该空网络。
- 原样重跑`npm run verify`退出0：15条场景记录全部通过，后端healthy、health载荷和请求标识、前端HTTP、7种无效配置退出2、占用端口退出1、有效配置恢复、5行JSON日志关联、停止后不可访问及重启恢复。
- 两次健康请求45.94ms/5.66ms，均低于原500ms标记阈值；这是本机健康检查耗时，不是业务压测P95。
- 验收结束后`campus-claw-plus-verify`容器已全部清理，没有停止其他项目运行容器。源码/Compose/检查脚本无变更；原断言保留。

原始命令与退出码见[local-recovery-results.json](local-recovery-results.json)，场景结果见[local-container-results.json](local-container-results.json)（移除本机端口值）。脚本中browserCheck字段是历史固定描述，本轮只做静态页HTTP回归，未新增浏览器视觉截图；00没有UI改动。

2.3完成，00改为待终审并将PR #5转为可审查。BC-SC-01仍未发生，小葛终审、main合入和集成复验未发生，G2/G3不提前成立。

## 2026-11-05 真实终审交接

小葛[APPROVE 5782045346](https://github.com/zwh9616/campus-claw-plus/pull/5#pullrequestreview-5782045346)绑定75cadbf，无返修项。本次只同步tasks 3.1、共享表和文档，未改运行代码/合同/测试。单项00严格校验及diff检查通过；未重跑容器。BC-SC-01、main合入及集成复验仍待完成，G2/G3未成立；限制与队列见[交接记录](day-two-review-handoff.md)。
