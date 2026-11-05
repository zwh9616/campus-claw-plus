# BC-SC-01 真实独立阅读验收（首次，未通过）

执行日期：2026-11-05；固定读取版本：`4cfd61d8119c51bc3bf2870a17c9754f0975b3dc`。
用户要求完成独立会话验收后，通过create_thread新建本地聊天，未fork或复制原会话历史/业务答案。自动附带的来源会话标识只用于追溯；新会话仍按仓库AGENTS读取工程约束。只读范围以新会话实际命令为证。

- 新会话：`01a1ac13-9fed-7c11-bc36-50d08ff7d88c`，标题“BC-SC-01 独立阅读验收”，host=local。
- 唯一执行轮次：`01a1ac13-ab06-78a2-9d54-2a97d90132df`，状态completed，耗时138769ms。
- 实际开始UTC：2026-11-05T14:18:52.000Z；完成UTC：2026-11-05T14:21:11.000Z。
- 新会话先读本地规则，发现本地HEAD不同后，使用git show/git grep读取指定4cfd61d；只读命令退出0，未改文件或发送远端消息。
- 本文件由原会话在验收结束后导出输入与完整最终输出，不把原会话作为独立验收者。工具记录保留在上述聊天，下面输出不作结论改写。

## 本次判定与交接

**已执行，但未通过。** 独立阅读能找到资料答疑、作业批改复核、接口状态/依赖和检查入口；错题订正缺少用户动作、提交内容、完成条件及保存结果，不能靠实现者猜测补齐。原会话随后在固定main工作树检索“错题/订正/error-explanation”，确认D5/D7/D9只有错题事务、讲解技能及planned责任，没有完整用户路径。

按BC-SC-01“缺少口头约定则退回规约”，交小葛补充00的三条主路径说明及08/09责任，必要时列明07B辅助边界。这里只要求用户路径可独立理解；不要求提前把planned API冻结为可调用operation，不擅自决定订正是否自动改原分、由谁判定通过。修订需小张审查，之后重新执行独立验收并保留本次失败。00 tasks 1.5/1.5b/3.2保持未勾，00不归档。

G2已由另行真实终审、main合入及集成复验成立；独立阅读本身不能证明G2，也不抹去既有集成事实。G3仍未成立；02仍等小葛复审、01仍等返修和公共冻结。02的ca51b41 CI [42042013441](https://github.com/zwh9616/campus-claw-plus/actions/runs/42042013441)已完成success，含check/audit/secret-scan/真实容器verify；这不替代BC-SC-01。

## 真实输入（完整）

```text
仓库：https://github.com/zwh9616/campus-claw-plus/tree/4cfd61d8119c51bc3bf2870a17c9754f0975b3dc
变更：2026-11-04-business-contracts

请以只读方式执行该变更的 BC-SC-01 独立阅读验收，给出可核对的文件定位和结果。不修改文件、不提交、不发送远端消息。
```

## 新会话最终输出（原文）

**BC-SC-01 独立阅读验收：未完全通过，需补充“错题订正”主路径说明。**

验收版本固定为 [`4cfd61d8119c51bc3bf2870a17c9754f0975b3dc`](https://github.com/zwh9616/campus-claw-plus/tree/4cfd61d8119c51bc3bf2870a17c9754f0975b3dc)。本次未获得原会话的业务结论，依据仓库文件独立阅读；判据见 [spec 第9—11行](https://github.com/zwh9616/campus-claw-plus/blob/4cfd61d8119c51bc3bf2870a17c9754f0975b3dc/openspec/changes/2026-11-04-business-contracts/specs/business-contracts/spec.md#L9-L11)。

| 验收项 | 独立阅读结果与定位 | 结果 |
|---|---|---|
| 资料答疑 | 可还原为身份与班级授权 → 本班资料检索 → 回查原文及出处 → 技能辅助、流式回答。依赖01、04、07A/B，工具接入另依赖03、07C，页面由06/09承接。[D4](https://github.com/zwh9616/campus-claw-plus/blob/4cfd61d8119c51bc3bf2870a17c9754f0975b3dc/openspec/changes/2026-11-04-business-contracts/design.md#L33-L37)、[D6](https://github.com/zwh9616/campus-claw-plus/blob/4cfd61d8119c51bc3bf2870a17c9754f0975b3dc/openspec/changes/2026-11-04-business-contracts/design.md#L53-L65) | 可定位 |
| 作业批改复核 | 可还原为提交 → submission/outbox/幂等快照同事务保存 → 202受理 → worker批改 → GradeResult建议 → 教师确认或改分 → published。05负责任务，07B产建议，08负责结果事务与人工优先。[D5 第41—51行](https://github.com/zwh9616/campus-claw-plus/blob/4cfd61d8119c51bc3bf2870a17c9754f0975b3dc/openspec/changes/2026-11-04-business-contracts/design.md#L41-L51) | 可定位 |
| 错题订正 | 找到错题事务归属08、页面归属09，以及 `error-explanation` 技能；但未找到学生如何进入订正、提交什么、怎样判断完成及结果如何保存的路径说明。[D5 第49—51行](https://github.com/zwh9616/campus-claw-plus/blob/4cfd61d8119c51bc3bf2870a17c9754f0975b3dc/openspec/changes/2026-11-04-business-contracts/design.md#L49-L51)、[共享表第37—38行](https://github.com/zwh9616/campus-claw-plus/blob/4cfd61d8119c51bc3bf2870a17c9754f0975b3dc/docs/project-status.md#L37-L38) | **不足** |
| 接口与依赖 | current仅health；6个认证/me操作为frozen但未运行；资料、任务、评分、会话等为planned，禁止猜路径或提前接线。G2后下游才能apply，业务实现合并还需G3。[端点矩阵](https://github.com/zwh9616/campus-claw-plus/blob/4cfd61d8119c51bc3bf2870a17c9754f0975b3dc/openspec/changes/2026-11-04-business-contracts/design.md#L100-L123)、[依赖表](https://github.com/zwh9616/campus-claw-plus/blob/4cfd61d8119c51bc3bf2870a17c9754f0975b3dc/docs/contracts/change-dependencies.md#L6-L25) | 可定位 |
| 检查命令 | 找到 `npm ci`、`npm run setup`、`check:contracts`、`check`、`audit`、`secret-scan`、`verify`；合同检查已包含在check内。[合同入口第27—39行](https://github.com/zwh9616/campus-claw-plus/blob/4cfd61d8119c51bc3bf2870a17c9754f0975b3dc/docs/contracts/README.md#L27-L39)、[实际脚本](https://github.com/zwh9616/campus-claw-plus/blob/4cfd61d8119c51bc3bf2870a17c9754f0975b3dc/package.json#L9-L22) | 可定位 |

阻断点是**第三条用户路径无法仅凭仓库完整复述**。planned接口尚未冻结属于明确允许的延期；但“错题订正”本身仍缺用户动作、输入输出和完成条件，不能把“错题页面＋讲解技能”自行推断成已约定闭环。建议由00规约负责人小葛补充路径及08/09的责任边界，小张复查后再验收。

本次真实输入、读取过程和结果保留在当前聊天中。遵照只读要求，未修改进度表或tasks、未提交、未发送远端消息，也未执行构建或容器测试；不能据此勾选BC-SC-01通过或宣布G2成立。
