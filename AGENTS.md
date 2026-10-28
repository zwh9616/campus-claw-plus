# CampusClawPlus 工程约定
第7课仅实现最小启动骨架。执行依据为 [proposal](openspec/changes/2026-10-28-project-bootstrap/proposal.md)、[design](openspec/changes/2026-10-28-project-bootstrap/design.md)、[spec](openspec/changes/2026-10-28-project-bootstrap/specs/project-bootstrap/spec.md) 与 [tasks](openspec/changes/2026-10-28-project-bootstrap/tasks.md)。PB-09只交接未来失败合同，本轮不实现教学业务。

## 每次开始工作
- 必读 [安全规范](docs/standards/security.md)，按范围必须读取下表规则；这些文件是约束，不是可选参考。
- 前端/文案：[产品规范](docs/standards/product.md)。
- Go/HTTP：[后端规范](docs/standards/backend.md)。
- 行为或用例变更：[测试规范](docs/standards/testing.md)，使用 [.agents/skills/campus-add-tests/SKILL.md](.agents/skills/campus-add-tests/SKILL.md)。
- 配置/镜像/日志/发布：[部署规范](docs/standards/deployment.md)，验证版本使用 [.agents/skills/campus-release-check/SKILL.md](.agents/skills/campus-release-check/SKILL.md)。

## 硬约束
- 配置样例只有HTTP_PORT=；真实值只在本机.env/进程环境，不进Git、镜像、日志。
- 当前仅公开GET /health，无认证、数据库、模型；返回{"status":"ok","dependencies":{}}，不加业务码外层；服务端生成X-Request-ID与JSON日志关联。
- frontend不依赖API；React18静态首页，不生成假业务入口。
- cmd/server只装配；config负责配置；httpserver负责HTTP边界；后续业务/存储不得反向依赖HTTP，不为骨架创建空业务层。
- 失败退出非零；不能删断言、放宽门禁、伪造新会话或跨机器通过。
- 分支和PR协作，提交说明关联PB/SC；用户明确授权的合并仍须遵守远端门禁，不伪造其他成员批准。
- 规约与规则不一致先同步明确约定，例外登记在具体规范中；不能默许两套健康契约。

## 当前命令
根目录 npm ci；npm run setup 安装前端；npm run check 跑基础/类型/构建/Go测试/严格规约；npm run audit 检查npm；npm run verify 运行本机容器集成验收。
npm run dev 启动前端；完整运行按README填.env后 docker compose up --build -d。
使用Docker Go工具链时镜像摘要见scripts/toolchain.json；没有本地Go也可验证。任一子项失败阻断。
