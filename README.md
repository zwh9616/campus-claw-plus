# CampusClawPlus
面向高校师生的课程助教与学习反馈项目。第7课只交付可运行的项目骨架，当前首页不限定学段。

## 当前能做什么
- React18 + TypeScript + Vite 静态首页：CampusClawPlus、Hello World、项目启动说明。
- Go标准库后端：公开GET /health、必需HTTP_PORT校验、JSON日志和请求标识。
- 两个独立容器：frontend/backend，一套Compose命令构建启动、检查和停止。
- 五类工程规范、AGENTS读取入口、测试/发布技能、自动检查与CI。

本轮没有登录、真实课程/资料、RAG、模型、数据库或作业功能。前端不调用后端；后续业务失败合同PB-09只交接规约，不能算运行通过。

## 基本使用：同伴和教师从零启动

运行系统只需 **Docker Desktop（Linux容器模式）**。Node.js、npm、Go和前端构建都在Docker中执行，不需要在本机安装。Git只用于获取代码，也可下载对应版本的源码ZIP。首次构建需要联网下载镜像和依赖。

### 1. 获取可运行代码

本实现通过[PR #2](https://github.com/zwh9616/campus-claw-plus/pull/2)交付。PR合并前，请在新目录获取以下实现分支：

```powershell
git clone --single-branch --branch feat/2026-10-28-member-b-foundation https://github.com/zwh9616/campus-claw-plus.git
cd campus-claw-plus
```

PR #2合并后，可以直接克隆默认main。已有该实现分支的同伴无需重复克隆，在工作区没有未提交代码修改时执行 `git pull --ff-only` 更新。

### 2. 准备本机配置

启动Docker Desktop，等待引擎可用。以下命令均在含有 `compose.yaml` 的仓库根目录执行。

Windows PowerShell：

```powershell
Copy-Item .env.example .env
notepad .env
```

macOS/Linux使用 `cp .env.example .env`，再用文本编辑器打开.env。已有.env不要覆盖。

将本机.env填写为：

```dotenv
HTTP_PORT=18080
```

这是后端端口，必须填写1..65535内的空闲端口；前端固定使用5173。若改用其他后端端口，下面健康检查地址也相应修改。.env只保存在本机，不提交Git；.env.example按课程要求只保留空值键名。

### 3. 一条命令构建并启动

```powershell
docker compose up --build -d --wait
```

Docker会自动安装前端依赖、构建前端、编译Go后端并启动两个服务。首次运行可能需要等待下载和构建；看到命令成功退出后再访问页面。只使用系统时无需运行后面开发者章节中的npm或Go命令。

### 4. 访问与确认启动成功

| 项目 | 地址或命令 | 成功现象 |
| --- | --- | --- |
| 首页 | [http://localhost:5173/](http://localhost:5173/) | 显示CampusClawPlus、Hello World和项目启动说明 |
| 后端健康检查 | [http://localhost:18080/health](http://localhost:18080/health) | HTTP200、JSON响应，含X-Request-ID响应头 |
| 容器状态 | `docker compose ps` | frontend为Up，backend为Up且healthy |

健康接口响应：

```json
{"status":"ok","dependencies":{}}
```

这里的空对象表示没有配置外部依赖，不表示数据库或模型已健康。当前首页是静态启动页，不提供登录、问答或作业操作。

Windows可在终端查看完整HTTP响应：

```powershell
curl.exe -i http://localhost:18080/health
```

macOS/Linux将curl.exe替换为curl。同伴需要在自己的电脑执行启动命令；localhost始终指当前执行者自己的电脑。

### 5. 查看日志、停止、重启和更新

| 操作 | 在仓库根目录执行 |
| --- | --- |
| 查看后端最近50行日志 | `docker compose logs --no-color --tail 50 backend` |
| 查看前端最近50行日志 | `docker compose logs --no-color --tail 50 frontend` |
| 停止系统 | `docker compose down --timeout 15` |
| 再次启动已构建系统 | `docker compose up -d --wait` |
| 获取当前分支更新 | `git pull --ff-only`（先保存本地代码修改） |
| 更新后重新构建启动 | `docker compose up --build -d --wait` |

关闭浏览器不会停止后台容器；停止系统请执行down。停止命令只作用于本项目。

### 常见启动问题

| 现象 | 处理方法 |
| --- | --- |
| 无法连接Docker引擎 | 启动Docker Desktop，确认Linux容器引擎已就绪；可用docker info检查 |
| 提示HTTP_PORT缺失或为空 | 检查仓库根目录.env，按上面的示例填写并重新启动 |
| 端口被占用 | 停止自己已有的本项目实例；后端可在.env改为空闲端口，前端5173需与占用程序协调 |
| 下载镜像或npm依赖失败 | 确认Docker能联网后重试同一启动命令；构建已配置依赖缓存和有限重试，无需在本机安装npm |
| 后端不是healthy或页面打不开 | 先运行docker compose ps，再查看对应服务日志；不要将仅running当作后端验收通过 |

同伴需留交叉验收证据时，可参考[Docker验收记录模板](docs/lesson-07/peer-docker-guide.md#同伴填写的验收记录)；上述基本使用步骤已完整写在本README中。

## 接口与日志
GET /health无需认证，HTTP200、application/json：
```json
{"status":"ok","dependencies":{}}
```
空依赖表示本轮没有外部依赖，不能据此声称MySQL/Qdrant已健康。服务端生成32位十六进制X-Request-ID，同次JSON请求日志使用相同标识，不信任客户端输入的标识。
Go日志字段：ts、level、module、message、request_id；HTTP日志另含method、path、status、duration_ms。启动/配置日志request_id=null；日志不含查询串、正文或配置原值。
未知后端路径404，错误方法405。当前没有业务码外层。镜像自带/server --healthcheck，不依赖curl。

## 开发者检查（同伴启动系统无需执行）
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
