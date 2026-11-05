# CampusClawPlus 工程约定
当前运行仍是第7课最小骨架，历史主规约见[spec](openspec/specs/project-bootstrap/spec.md)，归档依据见[历史变更](openspec/changes/archive/2026-10-28-project-bootstrap/)。本轮执行[00规约](openspec/changes/2026-11-04-business-contracts/proposal.md)、[design](openspec/changes/2026-11-04-business-contracts/design.md)、[spec](openspec/changes/2026-11-04-business-contracts/specs/business-contracts/spec.md)及[tasks](openspec/changes/2026-11-04-business-contracts/tasks.md)：仅落公共合同、规则和检查，不实现教学业务。PB/SC保留历史含义，新需求使用BC及后续change自己的前缀。

## 每次开始工作
- 必读 [安全规范](docs/standards/security.md)，按范围必须读取下表规则；这些文件是约束，不是可选参考。
- 必读 [共享进度表](docs/project-status.md) 与 [协作规范](docs/standards/collaboration.md)，先确认本次变更、两位负责人、前置条件和下一步；不得按人固定前端/后端/AI职责。
- 业务合同与门禁必读[合同入口](docs/contracts/README.md)和[依赖表](docs/contracts/change-dependencies.md)。G1只允许00 apply；G2（00终审、main合入、集成复验）后下游才能apply；业务实现合并还需G3（10前置门禁）。不能把本分支当G2已成立。
- 前端/文案：[产品规范](docs/standards/product.md)。
- Go/HTTP：[后端规范](docs/standards/backend.md)。
- 行为或用例变更：[测试规范](docs/standards/testing.md)，使用 [.agents/skills/campus-add-tests/SKILL.md](.agents/skills/campus-add-tests/SKILL.md)。
- 配置/镜像/日志/发布：[部署规范](docs/standards/deployment.md)，验证版本使用 [.agents/skills/campus-release-check/SKILL.md](.agents/skills/campus-release-check/SKILL.md)。

## 硬约束
- 配置样例仅含[配置登记](docs/contracts/config-register.json)active的空值键，当前仍只有HTTP_PORT=；未来新增键须受审change及缺失/超时规则。真实值只在本机.env/进程环境，不进Git、镜像、日志。
- 当前仅公开GET /health，无认证、数据库、模型；返回{"status":"ok","dependencies":{}}，不加业务码外层；服务端生成X-Request-ID与JSON日志关联。
- 当前frontend仍为React18静态首页、不依赖API；G2后02等按自身批准规约扩展，不生成假业务入口。frozen合同不等于已实现，planned操作禁止提前接线。
- cmd/server只装配；config负责配置；httpserver负责HTTP边界；后续业务/存储不得反向依赖HTTP，不为骨架创建空业务层。
- 失败退出非零；不能删断言、放宽门禁、伪造新会话或跨机器通过。
- 分支和PR协作，提交说明关联当前change的Requirement/Scenario（历史PB/SC、新00为BC）；用户明确授权的合并仍须遵守远端门禁，不伪造其他成员批准。
- 每次代码、测试、配置或脚本修改形成提交时，必须在同一提交更新共享进度表的对应行；阶段没变也写明本次改动、验证结果及下一步。交接、阻塞、返工、验收或规约变化也须同步；AI结束工作前同样检查，未测只能写未验证。详见协作规范。
- 规约与规则不一致先同步明确约定，例外登记在具体规范中；不能默许两套健康契约。

## 当前命令
根目录 npm ci；npm run setup 安装前端；npm run check 跑基础/类型/构建/Go测试/严格规约；npm run audit 检查npm；npm run verify 运行本机容器集成验收。
Node最低22.19.0；check还包含npm run check:contracts（OpenAPI3.1、2020-12单源双路径与语义反例），不替代既有门禁。新证据写reports/changes/<编号>/，历史archive和docs/lesson-07不倒改；未做的终审、新会话或集成不勾完成。
npm run dev 启动前端；完整运行按README填.env后 docker compose up --build -d。
使用Docker Go工具链时镜像摘要见scripts/toolchain.json；没有本地Go也可验证。任一子项失败阻断。
