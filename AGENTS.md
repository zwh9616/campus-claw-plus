# CampusClawPlus 工程约定
本分支默认运行已接入01身份与MySQL阶段，实际合入/验收状态见共享表。第7课骨架为历史基线，历史主规约见[spec](openspec/specs/project-bootstrap/spec.md)，归档依据见[历史变更](openspec/changes/archive/2026-10-28-project-bootstrap/)。本轮执行[00规约](openspec/changes/2026-11-04-business-contracts/proposal.md)、[design](openspec/changes/2026-11-04-business-contracts/design.md)、[spec](openspec/changes/2026-11-04-business-contracts/specs/business-contracts/spec.md)及[tasks](openspec/changes/2026-11-04-business-contracts/tasks.md)；00只负责公共合同。当前01按已批准身份规约接入数据库/身份，02按已批准规约推进登录；教学业务仍暂停。PB/SC保留历史含义，新需求使用BC及后续change自己的前缀。

## 每次开始工作
- 必读 [安全规范](docs/standards/security.md)，按范围必须读取下表规则；这些文件是约束，不是可选参考。
- 必读 [共享进度表](docs/project-status.md) 与 [协作规范](docs/standards/collaboration.md)，先确认本次变更、两位负责人、前置条件和下一步；不得按人固定前端/后端/AI职责。
- 业务合同与门禁必读[合同入口](docs/contracts/README.md)和[依赖表](docs/contracts/change-dependencies.md)。G1只允许00 apply；G2（00终审、main合入、集成复验）后下游才能apply；业务实现合并还需G3（10前置门禁）。不能把本分支当G2已成立。
- 前端/文案：[产品规范](docs/standards/product.md)。
- Go/HTTP：[后端规范](docs/standards/backend.md)。
- 行为或用例变更：[测试规范](docs/standards/testing.md)，使用 [.agents/skills/campus-add-tests/SKILL.md](.agents/skills/campus-add-tests/SKILL.md)。
- 配置/镜像/日志/发布：[部署规范](docs/standards/deployment.md)，验证版本使用 [.agents/skills/campus-release-check/SKILL.md](.agents/skills/campus-release-check/SKILL.md)。

## 硬约束
- 配置样例仅含[配置登记](docs/contracts/config-register.json)active的空值键，本分支已按01原子激活HTTP_PORT、七个身份键及五个R7接线键，均为空值；新增键须受审change及缺失/超时规则。真实值只在本机.env/进程环境，不进Git、镜像、日志。
- 当前公开GET /health每请求真实MySQL Ping，总预算3秒；200为status=ok/dependencies.mysql=up，失败503为status=error/mysql=down，不加业务码外层。六个已登记身份接口按01鉴权，planned业务仍不可调用；服务端生成X-Request-ID与JSON日志关联。
- 当前frontend按已批准02提供公开首页、登录、最小工作台与账号页，仅调用已实现的六个current身份接口；公开首页/404不发身份请求，生产禁止mock/samples入口。planned教学操作禁止提前接线；实际合入/验收以共享表为准。
- cmd/server只装配；config负责配置；httpserver负责HTTP边界；后续业务/存储不得反向依赖HTTP，不为骨架创建空业务层。
- 失败退出非零；不能删断言、放宽门禁、伪造新会话或跨机器通过。
- 分支和PR协作，提交说明关联当前change的Requirement/Scenario（历史PB/SC、新00为BC）；用户明确授权的合并仍须遵守远端门禁，不伪造其他成员批准。
- 2026-11-05起按组长新规则：审查者直接在原PR分支修复、验证、同提交同步共享进度，记录最终head结论后正常合并；不再仅因审查者参与修改而要求原作者再审一轮。适用当前未合并PR及后续工作，详见协作规范第1节。公共契约未定、检查失败或远端强制条件未满足仍阻断，不伪造他人批准。
- 每次代码、测试、配置或脚本修改形成提交时，必须在同一提交更新共享进度表的对应行；阶段没变也写明本次改动、验证结果及下一步。交接、阻塞、返工、验收或规约变化也须同步；AI结束工作前同样检查，未测只能写未验证。详见协作规范。
- 规约与规则不一致先同步明确约定，例外登记在具体规范中；不能默许两套健康契约。

01已合入[身份主规约](openspec/specs/identity-foundation/spec.md)及[01归档](openspec/changes/archive/2026-11-04-identity-foundation/)。02主规约与历史设计见[前端主规约](openspec/specs/frontend-foundation/spec.md)及[02归档](openspec/changes/archive/2026-11-05-frontend-foundation/)，#21已合入main并复验。04规约#23及机器合同#25已正常合入main；本实现候选按[04规约](openspec/changes/2026-11-10-materials-retrieval/proposal.md)启用六个资料操作，待小张终审及主干集成，其余教学变更继续暂停。主干状态见共享表。

本候选原子装配六个`current`资料操作（共13个current操作），新增000004三张资料表及真实SQL摘要，server只读检查精确目标4、离线admin迁移至4。资料以可信会话当前班级授权，学生只读ready；原始字节保留、索引事务及幂等、5秒业务预算/503与504、12次/分钟按用户配额和同快照出处回查遵循04。配置/服务/原健康及01旧SQL不变；前端仍只调用身份操作。详见[合同入口](docs/contracts/README.md)、[迁移方案](openspec/changes/2026-11-10-materials-retrieval/migration-plan.md)和[运行交接](docs/materials-runtime.md)。可执行代码不表示终审、部署或集成已经通过。

## 当前命令
根目录 npm ci；npm run setup 安装前端；npm run check 跑基础/类型/构建/Go测试/严格规约；npm run audit 检查npm；npm run verify 运行本机容器集成验收。
Node最低22.19.0；check还包含npm run check:contracts（OpenAPI3.1、2020-12单源双路径与语义反例），不替代既有门禁。新证据写reports/changes/<编号>/，历史archive和docs/lesson-07不倒改；未做的终审、新会话或集成不勾完成。
npm run dev 启动前端；完整运行按README填.env后 docker compose up --build -d。
使用Docker Go工具链时镜像摘要见scripts/toolchain.json；没有本地Go也可验证。任一子项失败阻断。
