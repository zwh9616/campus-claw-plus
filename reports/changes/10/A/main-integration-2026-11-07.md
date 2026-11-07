# 10 A 主干集成复验

执行人：小葛 / gjj6666（AI 辅助）。对应 DO-SC-02、DO-SC-09、DO-SC-10。

- #9 修复提交 b81d6989f90b85d702f8b1d4c03abf6b5a2e612f 的 [CI](https://github.com/zwh9616/campus-claw-plus/actions/runs/42355096122) 完整成功，绑定当前提交的[终审批准](https://github.com/zwh9616/campus-claw-plus/pull/9#pullrequestreview-5811099824)已提交。
- 用户授权后按分支保护正常合并。GitHub 回读 main 为 55f0e8364e150ff4c42f9af1facc8763e4274fa2，protected=true，required check 为 check，来源 GitHub Actions app 15368，对所有人执行。集成提交和已审提交的文件树一致。
- [main CI 42356275838](https://github.com/zwh9616/campus-claw-plus/actions/runs/42356275838/job/128354942897) 对该集成提交运行 make gate，结论 success。包含 check、audit、全历史及暂存扫描和真实容器验收。#12 旧批准失效的实际记录见[实验记录](stale-review-proof-2026-11-07.md)。
- 本机 check、audit、secret-scan 退出 0。verify 在启动容器前因 Docker Hub 认证接口超时退出 1，故完整本机 gate 退出 1。真实容器通过依据为上述集成 CI。
- 小葛提交本记录后，由小陈按下节复核共同登记 G3；3.1、3.2 已完成。

## 小陈复核与共同登记

小陈 / Kevcco（AI辅助），2026-11-07，审查 PR #17 的 dd5ab28032f4dd2b75a4718af3942521495f2e54。对应 DO-SC-02/08/09/10，实际 API 摘要见 [G3复核快照](g3-verification-2026-11-07.json)。

- 回读 #9：小葛 gjj6666 的真实 APPROVED 5811099824 绑定 b81d6989f90b85d702f8b1d4c03abf6b5a2e612f；实际合入 SHA 为 55f0e8364e150ff4c42f9af1facc8763e4274fa2。两者 Git 文件树均为 7ee6b898e8262573d193f720a0a79579876ce46a。
- 回读该 main SHA 的 push CI 42356275838：job `check` 及完整 `make gate` 步骤均为 success。核对工作流和 Makefile，仍通过同一 npm gate 串行执行 check、audit、全历史及暂存秘密扫描、真实骨架容器 verify。此结论是集成 CI 结果，不称为本次 Windows 本机容器通过。
- 当前 `GET branches/main` 返回 protected=true；required context 仍为 `check`、app_id=15368、enforcement_level=everyone。#17 在完整 CI 42356486461 成功、无文件冲突的情况下仍为 REVIEW_REQUIRED/BLOCKED，GraphQL 的 check.isRequired=true。与 #12 已保存的自动撤销旧批准、missing/pending/failure/cancelled 阻断实验一致。
- 本账号为 WRITE；完整 `/branches/main/protection` 本次返回404，GraphQL branchProtectionRule 为 null，rules/branches/main 返回空数组。这些读取不用于宣称保护缺失，也不冒称已重新读取全部管理员选项；完整设置沿用[小张实际管理员回读](main-protection-applied-2026-11-06.json)，当前生效性依据上述 branch、required check 和真实 BLOCKED 结果。未修改保护、未发送坏版本合并请求。

小葛的终审/主干复验与小陈上述核对已齐，**G3在 main 55f0e83 上成立**。此次仅登记已发生的验收；01/02仍须自身最终实现、真实依赖、审查与当前head检查。10 B/C和整体归档继续待办。
