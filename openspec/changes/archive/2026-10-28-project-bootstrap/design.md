## Context

基线为团队仓库 main 提交 d60bb57；仅有 README.md、.gitignore，无前后端、规约、依赖锁或部署配置。2026-10-28，经请求人授权，B 基于 A 的 69f85b4 追加评审修订；A 的原提交和历史校验记录保留。动机和本课边界见 proposal.md。2026-10-28，请求人确认以下技术口径作为提交 B/C 评审的草案；不等同于 B/C 已评审或实现通过。

## Goals / Non-Goals

**Goals:** 用两个独立服务证明页面、HTTP 接口、配置失败和一键启停能复现；给 B/C 一个明确可实现的契约，给 C 一个用于最终复核的场景矩阵。

**Non-Goals:** 不沿用个人旧仓库 Python 应用；不连接数据库、模型、向量库或任何外部凭据；不以静态页面宣称后续业务已可用。长期技术方案不构成本课实现清单。

## Decisions

### D1 技术与目录

- B：frontend/ 使用 React 18、TypeScript、Vite；提交 package.json 和一种包管理器的锁文件。评审候选为 npm/package-lock.json，命令 npm ci、npm run dev -- --host 0.0.0.0 --port 5173 --strictPort、npm run build。
- C：backend/ 使用 Go 标准库 net/http，入口建议 backend/cmd/server/main.go，模块根 backend/go.mod；配置和 handler 可放 internal/。无需 Web 框架或数据库驱动。
- C：根 compose.yaml 定义 frontend、backend；Dockerfile 分别放在 frontend/、backend/。前端生产构建产物由静态 HTTP 服务运行，容器端口候选80；开发服务本地5173不视为容器固定端口。
- B 维护 README、AGENTS、五类规范与忽略规则；C 维护镜像、Compose、配置示例和 docs/lesson-07/verification.md；docs/verification.md 可保留为索引。A 负责整体规约，当前经请求人授权由 B 追加本次修订。
- 五类规范只有一份权威内容（候选 docs/standards/）；AGENTS 必须明确要求按修改范围读取，不仅是可选参考链接。测试流程另提供可发现的仓库技能，后续 B 规范 PR 验证其实际生效。
- 本轮已落地 npm + frontend/package-lock.json、Go1.27.3、React18.3.1、Vite8.3.5、TypeScript7.0.2；构建镜像摘要记录在Dockerfile与scripts/toolchain.json。健康探针使用同一Go二进制的--healthcheck，不假设curl存在。
- 不强行分拆大量包或引入微服务框架；以最小骨架降低本课集成成本。C/B 在实现 PR 中固定工具链/镜像版本并记录，Go 声明版本与构建镜像兼容，Node 满足所锁 Vite 版本要求；这些版本不改变对外契约。

### D2 页面与健康接口

| 项目 | 约定 |
| --- | --- |
| 首页 | GET / 返回可阅读页面，显示 CampusClaw、Hello World、项目启动阶段说明 |
| 未实现业务 | 不显示可操作的登录、问答、作业、批改等伪功能入口 |
| 后端接口 | GET /health，公开，无需鉴权 |
| 成功响应 | HTTP 200；Content-Type 媒体类型 application/json，允许 charset=utf-8；JSON 语义等于 {"status":"ok","dependencies":{}}，允许结尾换行；X-Request-ID 为服务端生成的请求标识 |
| 依赖 | 本轮 dependencies={}，表示未配置外部依赖；不连接数据库、LLM、向量库，不宣称这些依赖已健康。后续引入依赖须另行变更规约、探针与测试，报告 up/down 并在必需依赖失败时返回503 |

不新增 /api 前缀、版本路径或前端 API 依赖；A/B/C 如更改接口须先同步本设计和场景。

### D3 配置与端口

唯一必需业务运行配置 HTTP_PORT 从进程环境读取，不默默默认8080。去除首尾空白后须为十进制数字且范围1..65535；缺失/空值、abc、0、-1、65536 均为失败。成功监听0.0.0.0:<HTTP_PORT>；失败须退出非零、指出 HTTP_PORT 及原因且不打印环境全集/密钥。端口占用导致监听失败也须非零退出。

.env.example 仅保留空值键名 HTTP_PORT=，无默认值或真实密钥；复制后由用户在本机 .env 填写，例如 HTTP_PORT=8080，值不入版本库。后端不自动读取根 .env；本地用户显式设置进程环境，Compose 从根 .env 插值并把 HTTP_PORT 传给 backend。Compose 不提供隐藏默认值，缺少变量时在配置阶段失败或后端启动阶段失败，不能取得健康成功。

| 服务 | 本地/主机验收地址 | 容器约定草案 |
| --- | --- | --- |
| frontend | http://localhost:5173/ | 主机127.0.0.1:5173 → 容器80（由C评审） |
| backend | http://localhost:8080/health（示例） | 主机127.0.0.1:${HTTP_PORT} → 同号容器端口 |

端口5173/8080占用时，先停止冲突进程或由负责人协商修改规约与README，不自动漂移端口。验收记录以实际配置值为准。不同宿主机远程访问不在本课验收范围内。

### D4 启停与检查

目标启动路径由 B 写进 README、C 实测；以下是合同草案，不是已执行的成功记录：

```powershell
git clone https://github.com/zwh9616/campus-claw-plus.git campus-claw-plus-clean
cd campus-claw-plus-clean
Copy-Item .env.example .env
# 用编辑器填写本机 .env：HTTP_PORT=8080（非机密示例；已有 .env 不覆盖）
notepad .env
docker compose config --quiet
docker compose up --build -d
docker compose ps
curl.exe -i http://localhost:8080/health
# 浏览器打开 http://localhost:5173/ 并保存页面截图
docker compose down
```

在独立源码目录签出待验收提交，按README准备配置和构建。2026-10-29请求人取消B单独跨机器复现作为归档前置，采用已有C运行证据及真实CI检查；不把同机新目录写成跨机器成功。验证PR未合并时先fetch并checkout对应分支/提交。开发检查实际失败仍非零退出，不用跳过命令冒充成功。

配置失败用例先构建后端到临时目录的可执行文件，再分别用环境变量缺失、空字符串及非法值直接运行，保存stderr和进程退出码，避免 go run 包装器掩盖实际退出状态。Go自动测试用相同参数表覆盖。使用有效、空闲端口恢复后请求健康接口，证明失败后可恢复。

Compose 的 backend 配置健康检查，探针必须检验约定状态/JSON且正确使用容器端口；镜像自带探针命令或C实现等价自检入口，不假设精简镜像含curl。记录启动到healthy的实际结果；不以容器running代替健康通过。down后确认容器停止，两个地址不再提供本项目响应。

### D5 证据与评审

PB需求、SC场景、tasks编号、PR和证据一一关联。docs/lesson-07/verification.md由C记录执行人/时间、提交号、OS/Go/Node/Docker/Compose版本、前置配置、完整命令、预期/实际、退出码/HTTP信息、截图/日志路径、结果及复测。A自己的严格校验与交接记录独立放 docs/openspec/，不冒充实现验收。

规约PR #1已合入main，历史评审保留；C已对实现PR #2实质评审并负责最终核对。2026-10-29请求人取消其余成员逐人补评审的归档前置；不伪造批准，不更改远端合并门禁。

### D6 日志、请求标识与停机

- 每条日志独占一行合法 JSON；字段 ts（UTC RFC3339）、level、module、message、request_id。启动/配置失败等无请求日志的 request_id=null；HTTP 完成日志的 request_id 必须非空，并包含 method、path（不含查询串）、status、duration_ms。
- 每次 HTTP 请求由服务端生成新的128位随机标识（32个十六进制字符），响应头 X-Request-ID 与该次完成日志一致；不信任或原样回显客户端提供的标识。健康响应体保持 D2 的两个字段，不强加业务码外层。
- 日志不得记录配置值、密码、令牌、请求正文、学生资料或原始堆栈。配置失败日志说明键名和脱敏原因，保持非零退出。
- 上述字段验收对象为Go应用日志；前端Nginx辅助访问日志同样为JSON，其原生耗时单位明确记为duration_seconds，不冒充毫秒。Nginx原生内部诊断不作为Go应用JSON证据。
- C 用 Go 标准库实现；SIGTERM/SIGINT 后停止接收新请求，最多10秒排空在途请求，Compose 停止宽限15秒。日志验证记录原始单行和解析结果，不以“有输出”替代结构检查。

### D7 四类失败合同与实现范围

PB-01..08 是本轮骨架/过程验收；PB-09 的 SC-20..23 定义后续受保护教学能力的失败合同，只验收规约是否明确，不让 C 在本轮实现这些业务。当前 SC-04/05 已覆盖配置参数非法；未知路由404可作为骨架附加检查，但不冒充已存在的教学资源授权测试。

后续接口须覆盖：非法参数400、已认证但功能权限不足403、不存在/跨班资源一致404、必需依赖不可达503。角色/班级来自可信会话，测试替身可以验证失败合同，不能伪称真实外部依赖运行通过。如果课程要求这些类别本轮均运行，则在课程要求确认后另建实现变更；没有获得豁免，不将“仅文档覆盖”写成运行完成。

### D8 新会话、证据与归档

- 合并前另开不带历史上下文的 Harness 会话，仅给仓库路径和变更名2026-10-28-project-bootstrap，检查能否定位任务、边界、接口、端口与验证步骤；规范落地后，第二次新会话在隔离分支做最小受控改动，按同一规则检查产物并恢复试验改动。
- 记录会话输入、实际产物/差异、规则命中、检查结果；由真实执行者填写，不以本次会话自我复述充当独立验证。
- 第7课证据保存在 docs/lesson-07/，docs/verification.md 如保留只作索引。跨机器记录执行人、机器与工具链、同一提交和完整启停结果。
- 采用C已有运行/页面/新会话证据和CI结果；SC-19受控改动、违规命中和恢复已留证，不额外要求该会话完整本地门禁补证。环境限制继续如实保留。
- 按2026-10-29明确授权，在B现有来源分支执行 openspec archive 2026-10-28-project-bootstrap --yes，同步主规约并严格校验。取消的三项前置单列范围调整，不勾成实测通过；本次归档不包含合并PR或打发布标签。

## Risks / Trade-offs

- [历史README学段不一致] → README已统一为高校；本轮页面只写项目名与骨架阶段，不扩大业务。
- [工具链与目录约定漂移] → 已落地npm锁文件、静态容器80、cmd/server和同一Go二进制探针，C已核对；后续替代须先修订规约与任务，不能静默偏离。
- [配置值缺失但Compose回退默认导致误成功] → 显式传变量、无隐含默认，同时验证直接运行与Compose缺失行为。
- [镜像内没有健康探针工具] → C在镜像中提供可运行探针并验收healthy状态。
- [仅OpenSpec严格校验通过被误当业务完成] → tasks分别跟踪规约、评审、实现、运行证据，后四项未发生不勾选。

## Migration Plan

规约PR #1已合入，B/C实现随PR #2交付；C按调整后的归档条件最终核对SC场景，在B来源分支归档。后续合并和标签单独执行。没有数据迁移或持久卷。实现回退时先docker compose down，再回到上一个已知可运行提交重新构建；规约与README须对应相同版本。

## Open Questions

原技术选择已由实现PR #2及C实际复核确认：npm锁文件、静态容器端口80、backend/cmd/server、固定摘要工具链和/server --healthcheck探针。当前无阻断分支归档的技术选择；改变对外接口或端口仍须先修订规约。
