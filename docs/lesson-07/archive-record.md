# 第7课骨架变更归档记录

日期：2026-10-29（Asia/Shanghai）。分支：`feat/2026-10-28-member-b-foundation`；PR #2。归档前基线：`928f4dd76e93e26ccbee3f2932c0901bc824c418`。

## 授权与范围调整

请求人明确要求取消B本人独立复现、SC-19完整本地门禁补证、其余成员评审记录作为归档前置，并直接在B现有分支归档。三项从本轮必验任务中移除，不伪造执行或批准；已有原始证据与环境限制保留。

采用C已提供的Docker健康/配置失败/端口占用/启停证据、页面两档视口和键盘检查、SC-18独立理解、SC-19受控违规与恢复实验，以及CI完整检查。C在PR #2的实质评审： https://github.com/zwh9616/campus-claw-plus/pull/2#pullrequestreview-5685833532 。不要求其余成员另补评审。

这次调整不删除测试断言、不跳过CI步骤，也不把本机Go/Docker不可用的历史失败改成成功。PB-09仍是未来合同，未实现为教学业务、未取得课程运行豁免。没有上一已验收版本，回滚未演练。

## 本次操作

1. 同步proposal/design/spec/tasks、README及验收规范中的前置条件。
2. 严格校验通过后执行 `openspec archive 2026-10-28-project-bootstrap --yes`，保留默认规约同步和校验。
3. 归档后检查主规约、任务状态、文档链接及 `npm run check:spec`。归档只是B分支中的变更，不代表PR已合并或发布标签已创建。

## 实际归档结果

使用仓库锁定的OpenSpec 1.13.0。归档前执行 `openspec validate 2026-10-28-project-bootstrap --strict --json`，退出0；1 passed、0 failed、issues=[]。

随后执行 `openspec archive 2026-10-28-project-bootstrap --yes`，退出0，未使用跳过校验或跳过主规约同步选项。工具输出如下（任务5.7即本次归档，运行前仍未勾选；归档后才补记完成）：

```text
Task status: 24/25 tasks
Warning: 1 incomplete task(s) found. Continuing due to --yes flag.

Specs to update:
  project-bootstrap: create
Applying changes to openspec/specs/project-bootstrap/spec.md:
  + 9 added
Totals: + 9, ~ 0, - 0, → 0
Specs updated successfully.
Change '2026-10-28-project-bootstrap' archived as '2026-10-28-project-bootstrap'.
```

- 实际归档目录：[2026-10-28-project-bootstrap](../../openspec/changes/archive/2026-10-28-project-bootstrap/)。目录保留原变更名，实际操作日期为2026-10-29。
- 当前主规约：[project-bootstrap/spec.md](../../openspec/specs/project-bootstrap/spec.md)，9个需求、23个场景。
- AGENTS、README与交接入口已改为有效归档/主规约链接；`check:spec`改为 `openspec validate --all --strict`，归档后继续严格校验所有当前规约与活动变更，CI其他步骤不变。

## 归档后校验

| 检查 | 实际结果 |
| --- | --- |
| `openspec validate --all --strict --json` | 退出0；主规约1 passed、0 failed、issues=[] |
| `openspec list --json` | 退出0；活动变更列表为空 |
| 归档完整性 | 25/25项任务已完成，0项未勾选；被取消的旧任务另列为范围调整；主规约9个需求、23个场景 |
| 文档链接检查 | 10份本次相关文档中69个本地链接均存在，0个断链 |
| `npm run check:foundation` | 退出0，配置空值样例/忽略规则/规范技能入口通过 |
| `npm run typecheck`、`npm run build` | 均退出0，前端生产构建成功 |
| `npm run check:spec` | 退出0；归档后的全量严格校验1 passed、0 failed |
| `npm run audit` | 退出0；根与前端均0 vulnerabilities |
| `node scripts/check-secrets.mjs` | 退出0；Gitleaks8.30.1全历史与暂存内容均无命中 |
| `git diff --cached --check` | 退出0，无空白错误 |

以上使用Node24.22.1；本次没有声称在当前本机重新运行Go/Docker完整门禁。完整门禁由新提交的远端CI实际执行，结果以PR #2对应提交检查为准。归档前远端B分支确认仍为928f4dd，未覆盖其他成员更新。
