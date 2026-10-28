> 历史阶段记录。规约PR #1现已合并；最新实现与验收状态以 [verification.md](verification.md) 为准。

# A 规约审查与 B/C 下一步
日期：2026-10-28。审查对象：[PR #1](https://github.com/zwh9616/campus-claw-plus/pull/1)，分支 docs/openspec，提交 69f85b4bdb84d3a88427daa54e9fe0dbd883da69。

这是协助 B 从 B/C 两种职责视角做的技术审查，不代替 C 本人评审。经用户要求，已由 zwh9616 正式提交 Request changes 和6条行内意见；未合并、未修改 A 规约。

## 结论
建议先修订下列课程符合性问题，再确认公共约定并合并规约；暂不直接进入全量实现。A 的四份产物、任务负责人、端口失败、Compose 探针和追踪矩阵均已写明，主要问题在课程验收覆盖，不在 OpenSpec 结构。

独立复跑：在导出副本中执行
`npx --yes --package @fission-ai/openspec@1.13.0 openspec validate project-bootstrap --strict --json`
退出 0；1 passed、0 failed、issues=[]。严格校验不能检查下列课程语义遗漏。

课程依据：[第7课任务清单](https://devops.hello1023.com/课程任务清单-第7课.html)。

## 需要 A 修订或明确的事项

### R1 [P1] 骨架日志缺少 JSON 与请求标识的验收
位置：[tasks.md 第23行](https://github.com/zwh9616/campus-claw-plus/blob/69f85b4bdb84d3a88427daa54e9fe0dbd883da69/openspec/changes/project-bootstrap/tasks.md#L23)、[spec.md 第65行](https://github.com/zwh9616/campus-claw-plus/blob/69f85b4bdb84d3a88427daa54e9fe0dbd883da69/openspec/changes/project-bootstrap/specs/project-bootstrap/spec.md#L65)。
当前仅要求启动日志、不泄露密钥，没有单行 JSON 或请求标识要求。按此实现，C 可以输出普通文本日志且通过全部现有 Scenario，却不能通过课程骨架核查。
建议：design 固定日志字段及请求标识生成/传递规则；spec 增加请求日志可解析为单行 JSON、包含 request_id、无敏感原值的场景；tasks 与证据矩阵同步。

### R2 [P1] 健康响应唯一字段限制排除了课程要求的依赖状态
位置：[spec.md 第17至25行](https://github.com/zwh9616/campus-claw-plus/blob/69f85b4bdb84d3a88427daa54e9fe0dbd883da69/openspec/changes/project-bootstrap/specs/project-bootstrap/spec.md#L17)。
SC-02 明确只能有 status 字段；课程核查要求 /health 返回依赖连通状态。照该合同实现，健康响应没有地方表达依赖状态。
建议：由 A/B/C 确认明确的健康响应结构。无外部依赖的本轮仍可保持不引入数据库/模型，用 dependencies={} 明示未配置依赖；如果未来声明了依赖则必须报告实际状态。不能仅为沿用 B 草稿强加 code/message 外层，也不能把空依赖当成 MySQL/Qdrant 已通过。修改后同步 Go 用例与容器探针。

### R3 [P2] 端口负例不能替代课程列举的四类失败场景
位置：[spec.md 第27至45行](https://github.com/zwh9616/campus-claw-plus/blob/69f85b4bdb84d3a88427daa54e9fe0dbd883da69/openspec/changes/project-bootstrap/specs/project-bootstrap/spec.md#L27)。
当前覆盖缺配置、非法端口、占用与恢复，但未覆盖课程列举的无权限、资源不存在、依赖不可达。四个端口错误取值不等于四类失败。
建议：由 A 明确本轮骨架与后续能力规约的覆盖层次；不适用项标出理由并与课程验收口径确认。若课程要求规约覆盖这些场景，可以先写后续能力约束与失败场景、明确本轮不实现。不得为了凑数让 C 临时实现完整登录、业务资源和数据库，也不得直接宣称四类已满足。

### R4 [P2] 环境样例应只保留键名，启动步骤需显式填值
位置：[design.md 第37行](https://github.com/zwh9616/campus-claw-plus/blob/69f85b4bdb84d3a88427daa54e9fe0dbd883da69/openspec/changes/project-bootstrap/design.md#L37)、[spec.md 第73行](https://github.com/zwh9616/campus-claw-plus/blob/69f85b4bdb84d3a88427daa54e9fe0dbd883da69/openspec/changes/project-bootstrap/specs/project-bootstrap/spec.md#L73)。
HTTP_PORT=8080 不是泄露密钥，但与任务清单“只写键名”不一致。改成 HTTP_PORT= 后，现有复制完立即 compose 的步骤会缺配置。
建议：.env.example 固定 HTTP_PORT=，README/启动设计增加填写本机 .env 的明确步骤；8080 仅作为说明中的非机密示例。同步 SC-08 与配置失败用例。

### R5 [P2] 最终流程缺少变更归档，证据位置需对齐课程
位置：[tasks.md 第35至39行](https://github.com/zwh9616/campus-claw-plus/blob/69f85b4bdb84d3a88427daa54e9fe0dbd883da69/openspec/changes/project-bootstrap/tasks.md#L35)。
当前最终任务只有验收/标签，未明确完成后归档本变更；运行证据统一到 docs/verification.md，而课程指定 docs/lesson-07/。
建议：任务补齐“验收通过→归档变更→骨架标签”的责任与证据；将第7课证据落到 docs/lesson-07/ 或在该目录提供可追踪索引。原 docs/verification.md 可保留为入口，无需重复维护两份记录。变更名也需核对课程 YYYY-MM-DD-short-name 命名约定。

### R6 [P2] 独立目录还不足以明确新会话与另一台机器验证
位置：[spec.md 第51至53行](https://github.com/zwh9616/campus-claw-plus/blob/69f85b4bdb84d3a88427daa54e9fe0dbd883da69/openspec/changes/project-bootstrap/specs/project-bootstrap/spec.md#L51)、[tasks.md 第36行](https://github.com/zwh9616/campus-claw-plus/blob/69f85b4bdb84d3a88427daa54e9fe0dbd883da69/openspec/changes/project-bootstrap/tasks.md#L36)。
独立目录测试能够发现漏提交，但不能单独证明另一台机器可运行；当前也未明确课程要求的无历史会话复现规约、规则生效验证。
建议：任务拆出新会话规约/规范验证，以及另一成员自己的机器从零启动；记录机器、提交、工具版本和执行人，实际执行后才能勾选。

## 公共约定：B/C 评审时确认
| 事项 | 审查建议 |
| --- | --- |
| npm、package-lock.json | 可接受，明确命令执行目录；依赖与锁文件保持一种组织方式 |
| React18 + TypeScript + Vite | 以 A 的约定为基准；B 的 React19 草稿先调整，升级需先确认设计 |
| Go 标准库、backend/cmd/server | 适合最小骨架；不强制照搬 B 草稿的大量业务分层空包 |
| frontend/backend 两容器；静态容器80 | 可接受；C 固定镜像与探针实现，不依赖镜像偶然存在 curl |
| 首页不依赖 API | 按当前 A 方案撤去 B 草稿健康面板与代理必填项；健康由 C 的命令/探针验收 |
| 高校/中小学 | A 引用的材料为高校，main README为中小学；需全组统一，确认前首页不写学段 |
| 五类规范位置 | A 建议 docs/standards，B 草稿在 .agents/rules；选一份权威内容，由 AGENTS 明确要求读取，避免两套副本 |

## 实际推进顺序
1. B/C 对 PR #1 提交实质意见，由 A 修订并重跑严格校验；公共约定无争议后再按团队权限合并，当前不代为批准。
2. B 把五类规范、AGENTS、README和基础配置对齐已确认规约，交 A/C 评审。B 的规范不能自行创造与规约冲突的本轮接口。
3. 规范确认后 B 做最小前端，C 做 Go、配置失败与测试；随后 C 接前后端镜像、Compose、健康探针和运行证据。
4. B 在自己机器按 README 从零复现，A 按场景核对；全组实际通过后归档、标签。

## B 本地草稿需要收缩的内容
本地尚未提交/推送。React19、健康查询外层 code/message/data/request_id、前端检查面板、FRONTEND_PORT/API_PROXY_TARGET、面向中小学的页面文案均与 A 的当前草案不一致。以上不是 A 迁就草稿的理由：待审查结论确认后，B 自己调整；本次只审查，不更改 A 或继续扩展实现。

## 正式评审回执
- 账号：zwh9616
- 状态：CHANGES_REQUESTED
- 审查提交：69f85b4bdb84d3a88427daa54e9fe0dbd883da69
- 行内意见：6 条
- 链接：https://github.com/zwh9616/campus-claw-plus/pull/1#pullrequestreview-5677532561
- 提交时间：2026-10-28 11:43（Asia/Shanghai）
- 后续：A 在原分支修订并推送；B/C复审和验证后再决定批准及合并。

## 直接协助修订回执
经请求人授权，B追加提交d1f9b2e到原PR，保留A历史记录。6条意见均回复并解决讨论，本人旧请求修改已撤销；新总结为COMMENTED，不是批准。严格校验通过。PR仍待独立复审，未合并。
修订总结：https://github.com/zwh9616/campus-claw-plus/pull/1#pullrequestreview-5677749765
