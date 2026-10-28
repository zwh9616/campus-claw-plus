# PR #2 C 成员交叉验收记录

## 对象与环境

- 审查 PR：https://github.com/zwh9616/campus-claw-plus/pull/2
- 被验收提交：`0fccbc7e2b66bbd7e091711efffbf1c9d73d1070`。
- 执行日期：2026-10-28，Asia/Shanghai。
- 执行人：C 成员实际运行并提供终端输出、日志与截图；本记录依据这些证据整理。
- 最终复核人：C。按请求人确认，最终场景复核由C负责，不再以A最终复核作为前置；历史规约贡献与其他成员实际评审记录保持不变。
- 环境：Ubuntu/Linux x86_64，内核 `6.2.0-35-generic`；Docker `28.3.3`（build `980b856`），Docker Compose `v2.39.1`。
- 运行配置：后端 HTTP_PORT 为 18080，前端端口 5173；配置仅保存在执行者的本机 `.env`。
- `git rev-parse HEAD` 与被验收提交一致；`git status --short` 仅列出验收输出文件，没有已跟踪源码改动。

## 本次已核对的结果

| 场景 | 预期 | 实际与证据 | 判定 |
| --- | --- | --- | --- |
| SC-01 首页 | 项目名、Hello World、启动阶段说明，无假业务入口 | [首页截图](evidence/c-peer/homepage.png) 显示上述内容；截图为桌面视图、浏览器缩放80% | 当前视图通过；不代替移动端或键盘走查 |
| SC-02 健康响应 | HTTP 200、application/json、status=ok、dependencies={}，请求标识可关联 | [HTTP响应](evidence/c-peer/health.txt) 与 [应用日志](evidence/c-peer/backend.txt) 的请求标识相同 | 通过 |
| SC-04 缺失或空端口 | 缺失、空字符串、全空白均报错并非零退出 | [配置失败输出](evidence/c-peer/config-failures.txt)：三种情况均指出 HTTP_PORT is required，退出2 | 通过 |
| SC-05 非法端口 | abc、0、-1、65536均明确失败 | 同上：格式或范围错误，四种情况均退出2 | 通过 |
| SC-06 配置恢复 | 有效配置后恢复健康响应 | [重新启动输出](evidence/c-peer/stop-restart.txt) 显示配置失败测试后有效配置启动成功；未单独实测带首尾空白的合法端口 | 普通有效配置恢复通过；Trim用例未复跑 |
| SC-07 端口占用 | 新进程监听失败并非零退出 | [端口占用输出](evidence/c-peer/port-conflict.txt)：HTTP_PORT listen failed，退出1 | 通过 |
| SC-08 集成运行 | 前后端运行，backend healthy，首页与健康响应正常 | [构建与运行输出](evidence/c-peer/build-start.txt)显示两镜像Built、退出0、两服务通过等待检查及HTTP200；[容器状态](evidence/c-peer/containers.txt)与首页截图互相印证 | 通过；构建步骤复用缓存，不作为无缓存重新编译证据 |
| SC-10 停止与再次启动 | 停止后两个地址不可用，再启动恢复 | [停止与恢复输出](evidence/c-peer/stop-restart.txt)：停止后无项目容器，两个curl均连接拒绝；恢复后backend healthy及HTTP200 | 通过；两段输出分别记录，不推断未提供命令的精确时间顺序 |
| SC-09 Compose 缺少必需配置 | 没有 HTTP_PORT 时配置阶段失败 | [缺少配置输出](evidence/c-peer/compose-missing.txt)：明确指出 HTTP_PORT 缺失，退出1 | 通过 |
| SC-16 请求日志关联 | 单行JSON、字段齐全、请求标识不同且与响应一致 | 应用日志共9条，其中8条请求完成日志，标识均为32位十六进制且各不相同；[客户端标识测试](evidence/c-peer/request-id.txt)显示服务端响应标识与日志一致，未采用 `client-controlled` | 通过 |
| SC-17 日志格式与失败原因 | 启动/配置日志为JSON、request_id=null，错误脱敏 | 启动和7种配置失败的应用日志均符合；文件未见凭据或堆栈 | 当前样本通过 |

应用日志中的 `backend-1 |` 是 Compose 的展示前缀；去掉前缀后逐行按 JSON 核对。8次请求均为 GET /health、状态200，包含 ts、level、module、message、request_id、method、path、status、duration_ms。处理耗时最大0.129ms，仅表示服务端处理耗时，不代表端到端性能验收。

健康响应中的 `dependencies={}` 表示本轮未配置外部依赖，不声称数据库、模型或向量库健康。

## 已执行的操作

配置失败场景使用已构建镜像直接启动真实 `/server`，没有映射主机端口：

```bash
docker run --rm --network none campus-claw-plus/backend:0.0.1
docker run --rm --network none -e "HTTP_PORT=<测试值>" campus-claw-plus/backend:0.0.1
```

分别测试空字符串、全空白、abc、0、-1、65536，立即记录每个进程的 `$?`。端口占用在已运行的后端容器内执行 `docker compose exec -T backend /server`，记录新进程的退出码。

启停操作为 `docker compose down --timeout 15` 与 `docker compose up -d --wait`。停止后检查 `docker compose ps -a`，再用设置3秒超时的 curl 检查后端与前端。原始可用输出见证据文件；聊天提供的输出按提供内容转录，没有补写未观测结果。

构建补证使用 `docker compose up --build -d --wait`，命令退出0，随后检查容器状态与 `/health`。构建输出中的Go编译、前端依赖安装与打包步骤均为 `CACHED`；本次确认构建上下文与Docker构建流程可用，不宣称重新执行了无缓存编译。输出中的容器此前已运行，因此也不将此次命令写作新建容器或冷启动证明。

构建证据仅将终端混合换行统一为LF；命令输出、状态、退出码与响应内容保持原样。

## 本次文档更新检查

- `git diff --cached --check`：通过。
- `node scripts/check-foundation.mjs`：退出0。
- `openspec validate 2026-10-28-project-bootstrap --strict`：退出0；此次使用本机全局OpenSpec 1.13.1，不冒充仓库锁定的1.13.0已复跑。
- `node scripts/check-secrets.mjs`：全历史与待提交内容均通过，退出0；Gitleaks 8.30.1工具包SHA256与脚本固定值一致。

上述检查用于本次文档与证据提交，不代替C环境的完整实现自动门禁或容器验收脚本。

## 剩余验收与交接

- 已补充本提交的Docker构建命令与结果；后续页面和新会话复核结论见 [C最终复核进展](final-review.md)。
- 已补充 [C最终页面走查](evidence/c-final/page-results.json)：1440×1000 与 360×800 均无横向溢出，404页可用Tab/Enter返回首页，无运行时异常或API请求；截图与键盘走查证据一并保存。
- 已保存独立新会话的 [SC-18报告](evidence/c-final/sc18-report.md) 与 [SC-19报告](evidence/c-final/sc19-report.md)。SC-18内容判据通过；SC-19的受控违规被基础检查拦截并在隔离分支恢复。两项报告均保留限制，不把它们扩写成跨成员或容器验收。
- Docker证据采集阶段未复跑npm/Go自动门禁与完整 `npm run verify`；后续本地文档/前端检查、审计及环境限制在最终复核进展中单独记录，不将B记录或CI写成本人复跑。
- SC-18/19独立会话已有真实记录；SC-18严格输入前提已用新项目会话复测，SC-19保留了Node/Go/Docker环境限制与恢复证据。B独立机器复现和正式PR实质评审仍需真实留证。
- C负责最终核对需求、场景与证据，其他成员按实际职责补充评审；本文件不是GitHub批准或合并回执。角色调整不免除未完成的运行、新会话和实质评审要求。
- 全部必验项完成后再由团队归档变更、复核合入并打最终标签；没有上一已验收运行版本，回滚未演练。

当前结论：所提供的启动、健康、配置失败、Compose缺少配置、端口占用、停止恢复、客户端标识替换与首页证据符合相应合同。本轮全组验收尚未完成。
