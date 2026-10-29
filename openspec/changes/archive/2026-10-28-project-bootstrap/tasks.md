只勾选已发生且有证据的工作。B/C与联合验收任务是交接清单，不表示A本次代为实现。需求与场景详见 specs/project-bootstrap/spec.md，证据索引见 docs/openspec/handoff.md。当前变更名2026-10-28-project-bootstrap；本轮实现PB-01..08，PB-09仅交接后续失败合同，不生成本轮业务代码。

## 1. 规约与评审 A 主责

- [x] 1.1 [A] 阅读两份任务材料并核对仓库基线；证据：proposal范围/不做事项、design.Context与交接记录；前置：可读main。
- [x] 1.2 [A] 初始化本仓库OpenSpec并完成proposal/design/specs/tasks；证据：四份产物、原始PB-01..06及SC-01..15；评审修订新增PB-07..09/SC-16..23，不把新增内容记作A原始贡献；前置：请求人确认技术草案。
- [x] 1.3 [A] 严格校验通过并记录工具版本、命令、退出码及修正情况；证据：docs/openspec/validation.md及原始输出；关联SC-13；前置1.2。
- [x] 1.4 [A] 交付接口/端口/配置/验收矩阵和B/C评审表；证据：docs/openspec/handoff.md；前置1.2。
- [x] 1.5 [A] 从docs/openspec推送规约PR，说明范围、验证、任务和交接；证据：https://github.com/zwh9616/campus-claw-plus/pull/1 和提交记录；关联SC-14；前置1.3/1.4。
- [x] 1.6 [B/C评审] B对规约PR #1评审修订，C核对当前公共契约和实现并在PR #2留评审；证据：spec-review-fixes.md、final-review.md及PR #2评审5685833532；按2026-10-29授权不追加逐人评审前置。
- [x] 1.7 [团队] 规约PR #1已按请求人明确授权及实际评审合并为a651871；历史记录保留。
- [x] 1.8 [B，经请求人授权] 追加R1..R6规约修订、复跑严格校验并记录；证据：docs/lesson-07/spec-review-fixes.md；保留A原始提交和验证记录。
- [x] 1.9 [B/C] 无历史会话仅凭仓库及变更名复核可执行性；证据：docs/lesson-07/evidence/c-final/sc18-report.md，真实输入输出与限制已保留；前置修订完成。

## 2. 工程规范 B 主责

- [x] 2.1 [B编写，C复核] 准备README、AGENTS与忽略规则；AGENTS链接规约及五类规范；实际随PR #2现有实现分支交付，未另造docs/standards分支；证据：docs/lesson-07/final-review.md；前置1.7；关联PB-05。
- [x] 2.2 [B编写，C复核] 编写product/backend规范，覆盖页面范围、Go职责、接口、配置与错误日志；每份含规则/示例/检查办法；证据：docs/lesson-07/final-review.md的SC-11复核；前置2.1。
- [x] 2.3 [B编写，C复核] 编写security/testing/deployment规范并与C核对配置、失败测试、镜像探针和启停；证据：docs/lesson-07/final-review.md、c-peer-review.md；前置2.1。

## 3. 最小前后端骨架 B C 主责

- [x] 3.1 [B] feat/frontend中建立frontend的React18/TypeScript/Vite入口及依赖锁；证据：npm ci、构建退出0；前置1.7及规范评审，采用不同包管理器先修订design。
- [x] 3.2 [B，C复核] 首页只显示约定文字和骨架说明；证据：docs/lesson-07/evidence/c-final/page-results.json及两档截图/键盘走查；无后续业务伪入口；前置3.1。
- [x] 3.3 [C] feat/skeleton中建立backend Go模块、入口、必需HTTP_PORT校验、单行JSON启动/配置日志和请求标识中间件；证据：缺失、空白、abc/0/-1/65536进程退出码及合法恢复；前置1.7；关联SC-04..07/SC-17。
- [x] 3.4 [C] 实现GET /health并添加Go测试；证据：go test ./...与SC-02/03状态码、类型、JSON、空依赖和X-Request-ID；请求完成日志满足SC-16，不使用外部依赖；前置3.3。
- [x] 3.5 [B→C] 交接前端构建命令、产物目录frontend/dist、容器内部端口80及锁定工具链；C已按README、Dockerfile/Compose和构建结果核对；证据：docs/lesson-07/final-review.md与c-peer-review.md；前置3.1/3.2。

## 4. 容器与配置 C 主责

- [x] 4.1 [C] 为前后端提供源码构建Dockerfile，后端镜像具备可执行健康探针；证据：镜像构建与容器内探针成功；前置3.4/3.5。
- [x] 4.2 [C] compose.yaml统一前后端服务、端口、HTTP_PORT传入和后端健康检查；.env.example仅HTTP_PORT=空值键名且无密钥；证据：compose config检查和SC-08/09/12；前置4.1。
- [x] 4.3 [C→B] 提供已验证的启动、日志排障、检查和停止命令，B收口README；证据：README步骤与实际命令一致；前置4.2。

## 5. 运行验收与追踪 全组

- [x] 5.1 [C] docs/lesson-07/verification.md按模板保存页面、健康、配置失败、占用与恢复的真实证据；证据：SC-01..07/SC-16/17逐项结果与复测；前置3.2/3.4。
- [x] 5.2 [B本机验证，C交叉复核] 已在B本机验证README启动、健康接口、配置失败及启停，并完成同机干净源码目录构建复测；证据：docs/lesson-07/verification.md、evidence/local-results.json与evidence/docker-only-clean-source.json。C的独立Docker启动与启停证据另见c-peer-review.md，不把两位执行人的记录互换。
- [x] 5.3 [C最终复核] 对照调整后的PB/SC核对范围、文档、接口及运行/页面/新会话/CI证据；证据：docs/lesson-07/final-review.md、c-peer-review.md、archive-record.md及PR #2实际评审；不把CI写成本机复跑。
- [x] 5.4 [C交叉复核，B保留实际评审] 课程要求的另一成员自行启动已由C完成并留存Docker证据；B对PR #1、C对PR #2的已有实质评审均可追溯；证据：docs/lesson-07/c-peer-review.md、final-review.md与spec-review-fixes.md。此项按课程交叉验证口径完成，不冒称其余成员逐人提交过PR批准。
- [x] 5.6 [独立新会话，C复核] SC-18验证仅凭仓库理解规约，SC-19受控改动、违规命中与恢复均已有记录；证据：docs/lesson-07/evidence/c-final/sc18-report.md与sc19-report.md。课程要求的新会话规则验证已完成；完整门禁使用实际CI结果，保留独立会话的本地环境限制。
- [x] 5.7 [C] 按2026-10-29授权直接在B现有来源分支运行OpenSpec归档并同步主规约、严格校验；证据：docs/lesson-07/archive-record.md；本次不合并PR或打标签。

2026-10-29再次按课程原文和已有证据核对，5.2、5.4、5.6按上述真实验证内容勾选。先前取消的是B再额外复现一轮、独立会话额外补跑完整本地门禁、其余成员逐人PR评审等追加前置，不表示课程对应要求未验证。任务5.5（合并后发布标签）仍在后续发布范围，不属于本次分支归档请求。


## 6. 后续合同交接（仅文档，不在本轮apply中实现）

- [x] 6.1 [B/C] 评审PB-09/SC-20..23四类失败合同，确认未伪称运行通过；证据：docs/lesson-07/final-review.md；本轮不据此新增业务端点。若课程要求本轮四类均实际运行，则先确认验收范围，再另建实现变更；未取得豁免前不得宣称整课全部完成。

## 当前执行备注

按请求人确认，C承担首页与最终场景复核，A不再作为最终复核前置。2026-10-29已授权直接归档B分支；随后核对课程原文与现有证据，将B本机启动、另一成员交叉启动、新会话规范验证明确标为完成。追加前置的取消不影响上述已有验证；不代填未执行结果，不改写历史贡献。

B/C技术任务经请求人授权由同一账号完成，提交身份不冒用其他组员。实现项及C复核已有真实证据；调整后的归档范围见archive-record.md。课程后续失败合同、回滚未演练及未发布状态继续如实保留。
