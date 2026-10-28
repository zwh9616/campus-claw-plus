## Context

基线为团队仓库 main 提交 d60bb57；仅有 README.md、.gitignore，无前后端、规约、依赖锁或部署配置。动机和本课边界见 proposal.md。2026-10-28，请求人确认以下技术口径作为提交 B/C 评审的草案；不等同于 B/C 已评审或实现通过。

## Goals / Non-Goals

**Goals:** 用两个独立服务证明页面、HTTP 接口、配置失败和一键启停能复现；给 B/C 一个明确可实现的契约，给 A 一个可核对的场景矩阵。

**Non-Goals:** 不沿用个人旧仓库 Python 应用；不连接数据库、模型、向量库或任何外部凭据；不以静态页面宣称后续业务已可用。长期技术方案不构成本课实现清单。

## Decisions

### D1 技术与目录

- B：frontend/ 使用 React 18、TypeScript、Vite；提交 package.json 和一种包管理器的锁文件。评审候选为 npm/package-lock.json，命令 npm ci、npm run dev -- --host 0.0.0.0 --port 5173 --strictPort、npm run build。
- C：backend/ 使用 Go 标准库 net/http，入口建议 backend/cmd/server/main.go，模块根 backend/go.mod；配置和 handler 可放 internal/。无需 Web 框架或数据库驱动。
- C：根 compose.yaml 定义 frontend、backend；Dockerfile 分别放在 frontend/、backend/。前端生产构建产物由静态 HTTP 服务运行，容器端口候选80；开发服务本地5173不视为容器固定端口。
- B 维护 README、AGENTS、五类规范与忽略规则；C 维护镜像、Compose、配置示例和 docs/verification.md；A 维护 openspec/ 与 docs/openspec/。
- 不强行分拆大量包或引入微服务框架；以最小骨架降低本课集成成本。C/B 在实现 PR 中固定工具链/镜像版本并记录，Go 声明版本与构建镜像兼容，Node 满足所锁 Vite 版本要求；这些版本不改变对外契约。

### D2 页面与健康接口

| 项目 | 约定 |
| --- | --- |
| 首页 | GET / 返回可阅读页面，显示 CampusClaw、Hello World、项目启动阶段说明 |
| 未实现业务 | 不显示可操作的登录、问答、作业、批改等伪功能入口 |
| 后端接口 | GET /health，公开，无需鉴权 |
| 成功响应 | HTTP 200；Content-Type 的媒体类型 application/json，允许 charset=utf-8；JSON对象语义等于 {"status":"ok"}，允许结尾换行 |
| 依赖 | /health 不连接数据库、LLM 或外部服务；本轮仅表示进程能够处理请求，不表示后续业务依赖健康 |

不新增 /api 前缀、版本路径或前端 API 依赖；A/B/C 如更改接口须先同步本设计和场景。

### D3 配置与端口

唯一必需业务运行配置 HTTP_PORT 从进程环境读取，不默默默认8080。去除首尾空白后须为十进制数字且范围1..65535；缺失/空值、abc、0、-1、65536 均为失败。成功监听0.0.0.0:<HTTP_PORT>；失败须退出非零、指出 HTTP_PORT 及原因且不打印环境全集/密钥。端口占用导致监听失败也须非零退出。

.env.example 示例仅 HTTP_PORT=8080，无真实密钥。后端不自动读取根 .env；本地用户显式设置进程环境，Compose 从根 .env 插值并把 HTTP_PORT 传给 backend。Compose 不提供隐藏默认值，缺少变量时在配置阶段失败或后端启动阶段失败，不能取得健康成功。

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
docker compose config --quiet
docker compose up --build -d
docker compose ps
curl.exe -i http://localhost:8080/health
# 浏览器打开 http://localhost:5173/ 并保存页面截图
docker compose down
```

独立目录须签出同一待验收提交；验证 PR 未合并时先 fetch 并 checkout 对应分支/提交。测试 backend 需 cd backend 后 go test ./...；前端在 frontend/ 执行 npm ci 与 npm run build。开发工具链未安装时须先按 README 安装；不能用跳过命令当成功。

配置失败用例先构建后端到临时目录的可执行文件，再分别用环境变量缺失、空字符串及非法值直接运行，保存stderr和进程退出码，避免 go run 包装器掩盖实际退出状态。Go自动测试用相同参数表覆盖。使用有效、空闲端口恢复后请求健康接口，证明失败后可恢复。

Compose 的 backend 配置健康检查，探针必须检验约定状态/JSON且正确使用容器端口；镜像自带探针命令或C实现等价自检入口，不假设精简镜像含curl。记录启动到healthy的实际结果；不以容器running代替健康通过。down后确认容器停止，两个地址不再提供本项目响应。

### D5 证据与评审

PB需求、SC场景、tasks编号、PR和证据一一关联。docs/verification.md由C记录执行人/时间、提交号、OS/Go/Node/Docker/Compose版本、前置配置、完整命令、预期/实际、退出码/HTTP信息、截图/日志路径、结果及复测。A自己的严格校验与交接记录独立放 docs/openspec/，不冒充实现验收。

规约PR从 docs/openspec 合入 main，由 B 看可读性、C 看可实现性；至少一位其他成员实质评审后合并，公共接口约定争议解决后实现。A不代填B/C评审，不自行合并或打最终验收标签。

## Risks / Trade-offs

- [README 目前只写中小学，而两份任务材料写高校] → 本轮页面只写项目名与骨架阶段；B在README收口时统一为本轮任务书/学期说明的高校定位，并由团队确认，不扩大业务。
- [B/C尚未确认 npm、容器80与入口目录] → 表列为待评审草案；请求人已批准基准技术与主机端口，B/C如提出替代须先修订对应表和任务，不能静默偏离。
- [配置值缺失但Compose回退默认导致误成功] → 显式传变量、无隐含默认，同时验证直接运行与Compose缺失行为。
- [镜像内没有健康探针工具] → C在镜像中提供可运行探针并验收healthy状态。
- [仅OpenSpec严格校验通过被误当业务完成] → tasks分别跟踪规约、评审、实现、运行证据，后四项未发生不勾选。

## Migration Plan

规约先评审；B/C在规约确认后按分工实现并分PR合入；B独立复现，A核对SC场景；C仅在全组验收完成后打标签。没有数据迁移或持久卷。实现回退时先 docker compose down，再回到上一个已知可运行提交重新构建；规约与README须对应相同版本。

## Open Questions

实现前由 B/C 评审并在PR记录以下选择：npm锁文件与命令、静态容器端口80、Go入口目录、镜像与工具链具体版本、backend健康探针实现。它们不改变已定义的页面/HTTP/配置失败契约；任何改变对外接口或端口的建议须先修订规约再执行。当前无 B/C 已确认的记录。
