# SC-19 独立新会话规则验证

- 执行会话：`01a18325-5dcc-71b3-9ce9-9b050c013846`，与来源会话不同。输入为仓库、变更名和SC-19实验要求；未提供项目实现答案。
- 被验收提交：`b50fe956bc92b216a575b6fcdc09fc72d1fe94ca`；隔离分支 `codex/sc19-independent-20261028`。
- 受控改动：为已有项目阶段说明添加 `aria-describedby` 与唯一 `id`，不增加API或业务入口；[差异](sc19/controlled-change.patch)。
- 隔离提交：`b329d065c20deb447e5e37c760c6e1dcfdd5f1c7`；恢复提交：`82687fc2de7f3947f405d18b7c40b9f8c05aabc5`。
- 故意违规：将 `.env.example` 改为 `HTTP_PORT=8080`；[差异](sc19/deliberate-violation.patch)。基础检查与完整检查均退出1，明确指出样例必须只有 `HTTP_PORT=`。
- 恢复：按原始字节恢复样例，基础检查退出0；随后revert受控提交，隔离受控树与基线的 `git diff --exit-code` 退出0。临时工作树已移除，隔离本地分支/提交保留，未推送。

## 真实命令与结果

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| `npm run check:foundation` 基线 | 0 | [输出](sc19/baseline-foundation.txt) |
| 受控改动后基础检查 | 0 | [输出](sc19/post-change-foundation.txt) |
| 受控改动后 `npm run typecheck` | 0 | [输出](sc19/after-setup-typecheck.txt) |
| 故意违规后基础检查 | 1，指出空值样例规则 | [输出](sc19/violation-foundation.txt) |
| 故意违规后 `npm run check` | 1，在基础规则阶段阻断 | [输出](sc19/violation-full-check.txt) |
| 恢复样例后基础检查 | 0 | [输出](sc19/restored-sample-foundation.txt) |
| 恢复全部改动后基础检查 | 0 | [输出](sc19/restored-all-foundation.txt) |
| 严格规约校验 | 0 | [输出](sc19/after-setup-check-spec.txt) |

## 限制

执行环境为Node20.12.2/npm10.5.0，低于仓库Node要求；前端完整构建缺少原生绑定，Go/Docker在该执行环境不可用。不能将本实验写成完整 `npm run check` 或容器验收通过。独立会话已证明受控产物类型检查及规定的“正常→违规阻断→恢复”流程；发布门禁仍按同一实现提交的CI与真实运行证据另行核对。

完整原始报告及未节选输出留在忽略的 `output/sc19-independent/`；本文件节选实验结果，省略个人路径和无关环境探测，不修改命令结果。
