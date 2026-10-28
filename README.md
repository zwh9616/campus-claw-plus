# CampusClawPlus
面向高校师生的课程助教与学习反馈项目。第7课只交付可运行的项目骨架，当前首页不限定学段。

## 当前能做什么
- React18 + TypeScript + Vite 静态首页：CampusClawPlus、Hello World、项目启动说明。
- Go标准库后端：公开GET /health、必需HTTP_PORT校验、JSON日志和请求标识。
- 两个独立容器：frontend/backend，一套Compose命令构建启动、检查和停止。
- 五类工程规范、AGENTS读取入口、测试/发布技能、自动检查与CI。

本轮没有登录、真实课程/资料、RAG、模型、数据库或作业功能。前端不调用后端；后续业务失败合同PB-09只交接规约，不能算运行通过。

## 协作者首次获取代码
协作者可直接克隆原仓库，无需fork；首次使用clone，已有仓库更新使用fetch/pull。推送仍需GitHub协作权限。
```powershell
git clone https://github.com/zwh9616/campus-claw-plus.git
cd campus-claw-plus
```
实现PR未合并时先fetch并签出该PR的分支/提交；默认main只有已合并内容。不要在有本地修改时reset --hard或覆盖.env。

## 从零启动（只需Docker Desktop和Compose）
先启动Docker Desktop，确认Linux容器引擎可用。所有命令在仓库根目录执行。
```powershell
Copy-Item .env.example .env
```
已有.env不要覆盖。样例只有HTTP_PORT=，用编辑器显式填写本机值：
```dotenv
HTTP_PORT=18080
```
8080也是合法示例；本次验收用18080以避开其他项目。端口范围1..65535，不能缺失、为空或自动回退。前端固定5173，若被其他项目占用先协调，不自动漂移或停止无关进程。
```powershell
docker compose config --quiet
docker compose up --build -d --wait
docker compose ps
curl.exe -i http://localhost:18080/health
```
打开[本机首页](http://localhost:5173/)。后端应为healthy；仅看到running不算健康通过。若HTTP_PORT填了其他端口，同步替换访问地址。
```powershell
docker compose logs --no-color backend
docker compose down --timeout 15
```
停止只影响本项目。再次执行up可重新启动。没有外部凭据、数据卷或数据库准备步骤。

## 接口与日志
GET /health无需认证，HTTP200、application/json：
```json
{"status":"ok","dependencies":{}}
```
空依赖表示本轮没有外部依赖，不能据此声称MySQL/Qdrant已健康。服务端生成32位十六进制X-Request-ID，同次JSON请求日志使用相同标识，不信任客户端输入的标识。
Go日志字段：ts、level、module、message、request_id；HTTP日志另含method、path、status、duration_ms。启动/配置日志request_id=null；日志不含查询串、正文或配置原值。
未知后端路径404，错误方法405。当前没有业务码外层。镜像自带/server --healthcheck，不依赖curl。

## 本机开发与检查
要求Node22.12+（推荐22系列最新补丁）、npm、Docker。Go可用本机1.27.3，或自动使用固定摘要的Go1.27.3容器工具链，无需全局安装。
```powershell
npm ci
npm run setup
npm run check
npm run audit
npm run secret-scan
npm run verify
```
- check：基础配置/规则入口、前端类型和构建、Go vet/test/build、严格OpenSpec。任何失败非零退出。
- audit：根与前端npm依赖high/critical阻断；不是Go/容器漏洞扫描的替代品。
- secret-scan：官方Gitleaks8.30.1，首次下载验证SHA256；扫描全部Git历史和暂存内容并全量隐藏原值。当前支持Windows/Linux x64，其他平台可手动使用同版本。
- verify：真实容器构建/健康、配置失败退出码、占用、恢复、JSON日志、停止再启动；使用单独的campus-claw-plus-verify项目，完成后停止验收容器。开始前先停本项目普通Compose实例以释放5173/HTTP_PORT。
- 输出：控制台；本机机器报告在output/verification/（忽略）；可审查结论和SC映射在[验收记录](docs/lesson-07/verification.md)。
- CI在push/PR自动运行同一套检查。未验证的新会话、第二台机器、其他成员批准仍须真实留证，不能以CI或同机新目录代替。

开发前端：
```powershell
npm run dev
```
仅本机5173，端口被占用退出；与Compose前端不能同时占用5173。构建产物frontend/dist/。
有本机Go时：
```powershell
cd backend
$env:HTTP_PORT="18080"
go run ./cmd/server
```
后端不会自动读取根.env。配置失败验收使用编译后二进制的真实退出码，不以go run包装器代替。

## 目录与分工
| 目录/文件 | 内容与责任 |
| --- | --- |
| openspec/changes/2026-10-28-project-bootstrap/ | A原始规约，B已按授权追加评审修订 |
| docs/standards/ | B的五类工程规范，唯一权威内容 |
| AGENTS.md、.agents/skills/ | B的常驻约束和场景流程 |
| frontend/ | B的最小静态页面、独立package-lock.json |
| backend/cmd/server、internal/ | C范围的Go装配、配置、HTTP、日志和探针 |
| compose.yaml、Dockerfile | C范围的构建部署；工具链固定摘要 |
| scripts/、.github/workflows/ | 本机与CI可复用门禁 |
| docs/lesson-07/ | 实际验证、场景映射与待办 |

本次B/C技术工作由请求人授权在同一账号完成，不冒用另一成员的提交身份或批准。每位组员的实际交叉评审和其他机器验收另行记录。

## 用户与页面
当前只有/，用于展示项目名和启动阶段；未知前端路径显示404页面并可返回首页。不提供假业务导航和健康面板。
产品、后端、安全、测试、部署规范见[AGENTS.md](AGENTS.md)的强制读取映射。资料/班级/出处术语在产品规范统一。

## 协作、发布与轮换
- feat/YYYY-MM-DD-short-name或docs/...分支，通过PR评审；提交说明关联PB/SC，不直接推main。
- 组长核对main保护、教师访问权限；门禁失败即阻断，不伪造他人批准。
- 最终完成条件包括实际新会话、另一成员自己的机器、问题闭环；之后归档变更、复核合入，再由C为最终提交打v0.0.1-skeleton。
- 首版无上一已验收运行标签，回滚演练标待办；未来用上一已验收提交/配置重建，不用git reset覆盖协作者工作。
- 密钥误入历史：持有人立即撤销旧值并轮换、更新环境并验证旧值失效，组长再协调历史清理；删除文件不等于撤销。完整流程见[安全规范](docs/standards/security.md)。

课程依据：[第7课任务清单](https://devops.hello1023.com/课程任务清单-第7课.html)。实际完成状态以[验证证据入口](docs/lesson-07/README.md)为准。
