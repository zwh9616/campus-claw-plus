# CampusClawPlus

本分支已将MySQL、离线迁移/初始化、身份HTTP服务和同源HTTPS接入默认Compose。身份及真实资料页面已在main合入，提供资料列表、检索、上传、原文及下载；小张已完成独立复验，合入及最终主干复验见[共享进度表](docs/project-status.md)和PR #30实际记录为准。

2026-11-13实际状态：05迁移#38、HTTP#40和worker#41已分别由小陈终审并正常合入；实现验收main d06198d完整CI43362518043成功，22 current、精确目标5。生产不绑定批改执行器/结果适配器，任务真实pending；05主规约及完整归档已随#42获小张批准并正常合入main c0f24f3；精确main完整CI43368065979复验通过，原件已核验。06资料归档#37已合入并复验；10-B全量/C、AI、成绩和作业页面仍未验收。

2026-11-13下一阶段已正式安排[04E资料能力扩展](openspec/changes/2026-11-13-materials-document-intelligence/proposal.md)，全部由小张负责。先实现文本PDF/.docx的真实上传、解析、出处与页面；OCR和语义/混合检索有[明确任务](openspec/changes/2026-11-13-materials-document-intelligence/tasks.md)及[量化验收](openspec/changes/2026-11-13-materials-document-intelligence/acceptance.md)。本候选提交A规约与六个frozen合同，尚未部署或启用新操作；运行仍22 current、Target5、仅原TXT资料功能。PDF不等于OCR，持久受理不等于解析完成；后续教学生成/成绩仍按独立前置推进。

## 当前运行范围

- GET /health匿名，逐请求真实Ping MySQL，3秒预算；200为status=ok/mysql=up，失败503为status=error/mysql=down，均有服务端X-Request-ID。
- 六个身份接口：登录、CSRF、刷新、me、登出、切班。04后端已随#26合入main6634e51并复验，另提供列表、详情、原文下载、教师上传、索引重试和keyword检索；具体输入/权限/失败响应见[公共合同](docs/contracts/README.md)及[资料运行交接](docs/materials-runtime.md)。本06候选已接资料页面，小张独立复验已通过，最终合入与主干复验见共享表；05九个作业/提交/任务接口已通过#40/#41终审合入，共22 current；生产尚无批改执行器，受理只表示持久pending，无AI/MCP/成绩接口或作业页面。
- 默认服务为frontend/backend/mysql；admin仅在tools profile用于离线操作。只向本机发布HTTPS，后端与数据库不发布主机端口；数据使用命名卷，server不自动DDL/初始化。
- frontend单独加入Compose自管ingress bridge，负责本机端口入口；backend/MySQL/admin仍使用内部网络，后端只信任内部proxy中Nginx的精确/32。验收同时检查实际主机发布端口与容器内链路。

本分支包含[#18主机入口修复](reports/changes/01/host-ingress-review-2026-11-08.md)：小张已在原Windows平台独立完整门禁通过，真实批准后正常合入main 0596505，同SHA CI42453041413成功。02已在原Windows默认入口完成正常证书信任的真实浏览器12项联验，含跨标签和并发刷新，见[独立联验](reports/changes/02/zhang-final-2026-11-08.md)；最终head90976b9完整CI通过并经小张真实批准，#15正常合入main3ef79f4；main复验结果见[合入记录](reports/changes/02/main-integration-2026-11-08.md)。

## 小组进度与协作入口

- [10-B运行批次](reports/changes/10/B/README.md)：当前01/02/04/06四服务登记见deploy/service-batches.json，`check:service-batches`核对来源/配置/网络/固定镜像及3秒探针；原`verify`三程序照常运行，再保存同轮同镜像摘要。首批#32获小葛终审后正常合入main b4b13fd并通过主干完整CI，[集成原件](reports/changes/10/B/main-integration-2026-11-12.md)已核对；后续服务及10-C另验。

- [共享进度表](docs/project-status.md)记录当前验收和交接。G2、G3已成立，身份和真实登录已在主干复验。01、02归档已分别随[#20](https://github.com/zwh9616/campus-claw-plus/pull/20)、[#21](https://github.com/zwh9616/campus-claw-plus/pull/21)合入，02主干完整检查42779317047成功；见[前端主规约](openspec/specs/frontend-foundation/spec.md)。04规约和机器合同已审定并随#23/#25合入；六个资料后端操作已随#26经小张批准合入main6634e51，主干完整CI42987148688成功。[资料主规约](openspec/specs/materials-retrieval/spec.md)与[04归档](openspec/changes/archive/2026-11-10-materials-retrieval/)已随#28经小张批准正常合入main78af20b，主干完整CI43002888185复验通过，见[归档证据](reports/changes/04/archive-review-2026-11-11.md)。
- [公共合同](docs/contracts/README.md)：现行22个current操作包括六个身份、MySQL健康、六个04资料操作及九个05作业/提交/任务操作，其余planned教学操作仍不可调用；npm run check:contracts接入原检查入口。
- [前端视觉规约](docs/standards/frontend-visual.md)：北大红#94070A、暖白、简约布局，参考Canvas/Moodle信息组织；小张已确认#15代表样板，真实页面已由小葛实现，最终联合验收由小张收口。
- [协作规范](docs/standards/collaboration.md)：按变更两人接力；每组可提交修改必须同提交更新共享表。
- [06资料阶段原change](openspec/changes/archive/2026-11-11-materials-frontend/proposal.md)已随#27获小葛批准，样板#29经小张确认，真实实现#30和严格414修复#31已合入复验。五项MF需求/十二场景完整同步[主规约](openspec/specs/materials-frontend/spec.md)，本候选仅做资料阶段归档与索引，最终head批准/合入仍待实际门禁；作业页面另等05。[归档核对](reports/changes/06/archive-review-2026-11-12.md)。
- 05规约#31、公共冻结#35、迁移#38、HTTP#40和worker#41均已审定合入；实现验收main d06198d完整CI43362518043通过。九个05操作与持久幂等/租约机制可用，生产无执行器而pending；已有4部署先停写、备份、离线升级5。小陈已准备[主规约](openspec/specs/assignment-tasks/spec.md)、[完整归档](openspec/changes/archive/2026-11-12-assignment-tasks/)及[主干证据/下游交接](reports/changes/05/archive-review-2026-11-13.md)，#42已获小张实际批准并正常合入main c0f24f3，精确主干复验见[实际收口](reports/changes/05/archive-main-2026-11-13.md)。

## 从零启动身份服务

需要Docker、Node>=22.19及持有人提供的数据库/HTTPS可信证书和本机秘密文件。无默认证书或账号口令；不把测试临时CA安装到系统，不跳过TLS校验。准备细节见[身份部署步骤](deploy/identity/README.md)。

1. 获取受审版本；已有目录先保留未提交修改，不能强制覆盖。本05迁移基础候选精确要求数据库版本5，已有版本4须先停止写流量并保存一致备份，再离线升级；旧程序拒绝数据库5、新程序拒绝4，回退须隔离恢复版本4备份，见[迁移恢复](docs/identity-migrations.md)。
2. 在忽略的output/identity-local准备root-password、initialize.sql、数据库TLS材料、backend.env、admin.env和seed.json。应用DML账号与离线DDL账号分离；秘密不发群、不进Git/镜像/截图。
3. 按部署步骤创建本项目独占internal代理网络，选择未占用静态地址。把根.env.example复制为本机.env（已有文件不要覆盖），填写HTTP_PORT、五个IDENTITY_*及HTTPS_CERT_FILE/HTTPS_KEY_FILE。MYSQL_*和AUTH_TRUSTED_ORIGIN由对应进程env文件提供；AUTH_TRUSTED_PROXY_CIDRS由Compose从代理IP派生为精确/32，不再在多个地方复制秘密。
4. 按顺序构建、迁移、初始化、启动。以下均从仓库根执行，wrapper只校验键与文件，不打印配置值。

```text
node scripts/identity-compose.mjs .env --profile tools build mysql admin backend frontend
node scripts/identity-compose.mjs .env up -d --wait --wait-timeout 120 mysql
node scripts/identity-compose.mjs .env run --rm -T admin migrate
node scripts/identity-compose.mjs .env run --rm -T admin check
```

PowerShell经标准输入初始化，口令不作为命令行参数：

```powershell
Get-Content -Raw output/identity-local/seed.json | node scripts/identity-compose.mjs .env run --rm -T admin initialize
node scripts/identity-compose.mjs .env up -d --wait --wait-timeout 90 backend frontend
```

准备完成后，直接docker compose up --build -d --wait也运行同一默认身份入口。访问配置的HTTPS主机/端口；客户端必须信任证书且SAN匹配。/health应为mysql up；浏览器可从首页进入真实登录，登录后进入最小工作台与账号页。使用持有人本机初始化的真实账号；教师可切换其所属班级，学生不能越权，刷新恢复与退出按02身份客户端处理。

重复初始化不覆盖既有口令；SQL/结构/摘要不一致或dirty时拒绝启动，按[迁移恢复](docs/identity-migrations.md)前向修复，不盲目force、不删库。首次卷的initialize.sql不会在已有卷自动重跑。

## 停止、恢复与排错

```text
node scripts/identity-compose.mjs .env down --timeout 15
node scripts/identity-compose.mjs .env up -d --wait --wait-timeout 90
```

正常down保留数据卷；真实账号环境禁止加--volumes。只操作自己的Compose项目。缺配置/CA/私钥/有效迁移须非零失败；数据库停机时真实健康503，恢复后重新Ping。不要分享展开的compose config或完整容器inspect，其中可能含密码。

Docker自动地址池耗尽时不要清理无关项目网络：为本项目data网络选不冲突的显式ipam subnet，写在忽略的本机Compose覆盖文件中，并以-f compose.yaml -f 本机覆盖文件启动。隔离验收器会仅为自己的临时data网络选空闲网段，保留原服务、健康和隔离策略。

## 检查与协作

npm run gate串行执行check、audit、secret-scan、verify；失败阻断。verify在随机独占项目验证默认生产server/Compose、可信HTTPS和MySQL、原启动/配置/日志/停止回归，再执行真实身份/迁移测试。临时测试CA和随机秘密随运行清理；它不证明持有人证书已就绪或浏览器真实联验已完成。

[共享进度](docs/project-status.md)、[协作规范](docs/standards/collaboration.md)、[前端视觉](docs/standards/frontend-visual.md)。01/02登录闭环已验收；04资料后端及归档已合入，归档main复验见集成记录；06资料页面规约见#27，其余教学实现按各自批准与依赖推进。下方第7课分工/历史章节保留历史含义，不反向修改归档证据。

## 开发者检查（同伴启动系统无需执行）
要求Node22.19+（推荐22系列最新补丁）、npm、Docker及Compose v2。Go可用本机1.27.3，或自动使用固定摘要的Go1.27.3容器工具链，无需全局安装。
```powershell
npm ci
npm run setup
npm run gate
```
- gate：串行运行check → audit → secret-scan → verify，失败立即非零退出，后续项标记未运行；超时分别为10/3/5/10分钟，取消同样失败。安装仍须先完成上面的ci/setup，安装失败不得继续。单项npm命令保持可用。
- GNU Make用户可等价执行`make setup`后`make gate`；`make check/audit/secret-scan/verify`薄封装对应npm命令。未安装Make时使用上述npm入口，不能把Make缺失记为通过。CI安装后执行同一`make gate`。
- 同一工作区同时运行gate会拒绝第二次调用；异常中止留下`output/verification/gate.lock`时，先确认旧进程及其子进程已停止，再删除该锁并重跑。不同干净目录的verify使用独立项目、镜像标签及Docker原子分配的环回端口，结束时仅清理自己的资源。
- check：基础配置/规则入口、OpenAPI/Schema及语义反例、前端类型和构建、Go vet/test/build、严格OpenSpec。任何失败非零退出。
- audit：根与前端npm依赖high/critical阻断；不是Go/容器漏洞扫描的替代品。
- secret-scan：官方Gitleaks8.30.1，首次下载验证SHA256；扫描全部Git历史和暂存内容并全量隐藏原值。当前支持Windows/Linux x64，其他平台可手动使用同版本。
- verify：把原启动/配置/健康/日志/停止回归类别迁移到当前默认身份入口，再运行真实身份/迁移测试。使用随机独占项目、临时配置/CA和Docker分配的环回端口，保留唯一MySQL健康合同；只清理自己的测试容器、网络与数据卷，不影响普通运行项目。
- 镜像验收先用固定版本的 Trivy 准备官方漏洞库。常规验收优先使用 GHCR，Google 镜像作为 Trivy 支持的临时错误备用源。慢网首次下载可先运行 `npm run prepare:scan-db`，该命令优先使用官方 ECR，限时 15 分钟。准备成功后运行 `npm run gate`。四个镜像共用当前工作区的库缓存，各自重新扫描，Trivy 按正常规则检查库的更新时间。准备和扫描共用工作区锁，准备失败会停止验收。
- 10 A进度与验收边界见[门禁交接](reports/changes/10/A/README.md)。CI绿色不等于主干保护生效；G3还要求有效保护、受控阻断、小葛终审和main集成复验。
- 输出：控制台；本机机器报告在output/verification/（忽略）；可审查结论和SC映射在[验收记录](docs/lesson-07/verification.md)。
- CI在push/PR自动运行同一套检查。按2026-10-29确认的归档范围，采用C已提供的运行/页面/新会话证据和CI结果；已取消的三项前置见[归档记录](docs/lesson-07/archive-record.md)，未执行结果不冒充通过。

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
| openspec/specs/project-bootstrap/spec.md | 归档同步后的当前主规约 |
| openspec/changes/archive/2026-10-28-project-bootstrap/ | A原始规约、B评审修订及C最终核对，已在本实现分支归档 |
| docs/standards/ | B的五类工程规范，唯一权威内容 |
| AGENTS.md、.agents/skills/ | B的常驻约束和场景流程 |
| frontend/ | B的最小静态页面、独立package-lock.json |
| backend/cmd/server、internal/ | C范围的Go装配、配置、HTTP、日志和探针 |
| compose.yaml、Dockerfile | C范围的构建部署；工具链固定摘要 |
| scripts/、.github/workflows/ | 本机与CI可复用门禁 |
| docs/lesson-07/ | 实际验证、场景映射与待办 |

本次B/C技术工作由请求人授权在同一账号完成，不冒用另一成员的提交身份或批准。C负责最终复核，已有实际评审与运行证据保留；不要求其余成员追加评审作为本轮归档前置。

## 用户与页面
当前只有/，用于展示项目名和启动阶段；未知前端路径显示404页面并可返回首页。不提供假业务导航和健康面板。
产品、后端、安全、测试、部署规范见[AGENTS.md](AGENTS.md)的强制读取映射。资料/班级/出处术语在产品规范统一。

## 协作、发布与轮换
- feat/YYYY-MM-DD-short-name或docs/...分支，通过PR评审；提交说明关联PB/SC，不直接推main。
- 组长核对main保护、教师访问权限；门禁失败即阻断，不伪造他人批准。
- 本轮按[归档记录](docs/lesson-07/archive-record.md)调整验收范围，由C最终核对并直接在B的PR来源分支归档、同步主规约和严格校验。合并PR及发布标签另行处理，不包含在本次归档中。
- 首版无上一已验收运行标签，回滚演练标待办；未来用上一已验收提交/配置重建，不用git reset覆盖协作者工作。
- 密钥误入历史：持有人立即撤销旧值并轮换、更新环境并验证旧值失效，组长再协调历史清理；删除文件不等于撤销。完整流程见[安全规范](docs/standards/security.md)。

课程依据：[第7课任务清单](https://devops.hello1023.com/课程任务清单-第7课.html)。实际完成状态以[验证证据入口](docs/lesson-07/README.md)为准。

## 06资料页面候选的检查

资料路由：`/app/materials`、`/app/materials/upload`、`/app/materials/{id}`。仅可信教师身份可上传/重新处理，学生只读ready。上传结果不确定时手动点击“确认上传结果”，更换内容须确认新上传；刷新、离开或身份变化会清理内存，请先核对列表。

`npm run check:frontend-auth`包含原认证与资料用例。mock页面：使用外部Playwright1.56.0，运行`node frontend/tests/materials-browser.mjs --playwright ABSOLUTE_PLAYWRIGHT_PATH --origin http://127.0.0.1:5197 --output output/material-browser`。Windows可信真实浏览器：`npm run verify:materials-browser -- --playwright ABSOLUTE_PLAYWRIGHT_PATH`，需已安装相应Firefox/Python与Docker；只在临时NSS配置导入测试CA，不改操作系统信任库。完整原门禁仍为`npm run gate`；浏览器证据单列，不用它代替完整门禁。

05首批#38仅提供000005五表与精确目标5迁移基础；本独立2.2/2.3候选实际接线九个已批准操作并同步22 current，提供作业与原子幂等提交。未绑定生产执行器，受理持久保持pending；worker、成绩和作业页面未完成。真实自测及终审状态以共享表为准，不把SQL available当成任一持有人数据库已升级。
06资料阶段已通过#30/#31主干复验，本PR仅同步[资料前端主规约](openspec/specs/materials-frontend/spec.md)与[原change归档候选](openspec/changes/archive/2026-11-11-materials-frontend/)。归档合入按实际PR记录为准，资料现有运行代码保持已验收main，作业页面另等05。
2026-11-12运行批次更新：#32最终510e882获小葛实际批准，用户明确授权后正常合入main b4b13fd，主干完整CI43194409869通过，10-B第一批B1.3完成；[实际原件](reports/changes/10/B/main-32-integration-2026-11-12.md)。B全量/C及其他未就绪服务仍按原准入待验；06资料归档候选见[清单](reports/changes/06/archive-candidate-2026-11-12.md)。

2026-11-13下一阶段04E全部由小张负责，A优先PDF/Word，B OCR和C向量/混合检索已正式列出[任务](openspec/changes/2026-11-13-materials-document-intelligence/tasks.md)与[验收阈值](openspec/changes/2026-11-13-materials-document-intelligence/acceptance.md)。首批合同#45已获实际批准合入main25484d5并复验通过。本组件开始[离线解析核心](document-parser/README.md)：`npm run check:document-parser`实际测试固定40份文件/25类负例并接入原check，verify保留原完整集成后另扫候选解析镜像。当前仍22 current/Target5/四个默认生产镜像；PDF/Word上传HTTP、持久作业和真实页面、OCR/语义检索均未启用，阶段状态见[共享表](docs/project-status.md)。

## PDF 与 Word 资料页面样板（04E）

本轮只提供隔离合成样板，真实PDF/Word页面尚未接线；当前生产TXT资料功能保持。[说明与验收](reports/changes/04E/document-sample-2026-11-13.md)。在仓库根执行：

```text
npm run samples --prefix frontend
```

打开 `http://127.0.0.1:5174/samples.html?page=documents`；通过“上传资料”或资料标题查看上传/详情。添加`role=student`查看学生只读视图，`state=loading|empty|error`查看各态，`long=1`查看长内容边界。列表检索“瞬时变化率”可演示页/逻辑块出处定位；上传只检查所选文件的名称和大小，不读取或发送文件内容。普通dev/生产不开放samples或候选业务路由，不需要提供真实账号/证书/文件。
