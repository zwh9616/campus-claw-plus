# 02 前端应用基础归档核对（2026-11-09）

小张（AI 辅助）从已合入 01 归档的 main `2e8586a0958abda940139031069654d6077972ac` 整理 02。01 的 #20 在 `9c87e55` 完整 CI 成功后，经小张批准 `5822096876` 正常合入。合入树与批准提交一致。主干首次复验在下载 Gitleaks 时失败，后续容器验收未执行。同一提交重跑后，check、audit、secret-scan、verify 均退出 0。 [#20 审查](https://github.com/zwh9616/campus-claw-plus/pull/20#pullrequestreview-5822096876) · [#20 CI](https://github.com/zwh9616/campus-claw-plus/actions/runs/42458583695) · [主干复验](https://github.com/zwh9616/campus-claw-plus/actions/runs/42569669625)

| 场景 | 归档依据 |
| --- | --- |
| FEF-SC-01..10、13、15 | 11 项认证检查与受控红绿回归覆盖登录、恢复、越权、切班、登出和迟到响应。48 态 mock 检查另列，最终发布检查含样板隔离。[终审与原件](zhang-final-2026-11-08.md) |
| FEF-SC-11/12、16..19 | 小张已确认代表样板。小葛保留 78 态视觉自测、实际对比度及键盘证据。小张在干净 `9ebf44b` 的 360/1440 两档执行 32 态原生 200% 复核，记录缩放回读、DPR、布局和截图。[样板确认](sample-approval-2026-11-07.md) · [视觉自测](final-visual-2026-11-08.md) · [原生缩放清单](zhang-native-200-2026-11-08/manifest.json) |
| FEF-SC-14 | 小张使用默认主机入口、正常校验证书链与主机名的 Firefox，完成真实 MySQL 双班五人 12 项联验。#15 的已批准提交 `90976b9` 与合入的 `3ef79f4` 整树一致，主干完整 CI `42456168251` 成功。[真实浏览器原件](zhang-final-2026-11-08/real-browser.json) · [合入复验](main-integration-2026-11-08.md) |

本次重算了 11 项运行与测试输入、48 份终审证据和 37 份缩放证据的摘要。32 个缩放截图均存在，两个档位的缩放回读为 2，未见横向溢出。真实浏览器 12 项的原件全部标记通过，mock 清单独立记录 48 态。核对了 #15 批准与合入提交的绑定关系。 [运行输入及证据摘要](zhang-final-2026-11-08/source-manifest.json) · [缩放摘要](zhang-native-200-2026-11-08/hashes.json)

OpenSpec 1.13.0 归档命令退出 0，写入 7 项需求。4.4 表示本分支已完成证据核对、归档和主规约同步。小葛负责审查候选的主规约、路径和证据，主干归档状态按实际批准、CI 和合入更新。长期部署、版本回滚、00 独立阅读及 10 B/C 仍按各自任务跟踪。 [前端主规约](../../../openspec/specs/frontend-foundation/spec.md) · [02 归档](../../../openspec/changes/archive/2026-11-05-frontend-foundation/)

在 Windows、Node 25.2.1、npm 11.6.2 和 Docker 29.8.0 的归档工作树上，`npm ci`、`npm run setup` 与 `git diff --cached --check` 通过。归档前后 7 项需求及 19 个场景正文一致，90 个本地链接有效，运行、测试、配置和第 7 课基线一致。`npm run gate` 的 check、audit 和 secret-scan 退出 0，OpenSpec strict 为 7/7。首次 verify 在 Trivy 下载漏洞库时遇到 `unexpected EOF`，重跑 `npm run verify` 时同一下载超时，两次均退出 1。失败原件留在本机 `output/`。本轮本机镜像扫描和后续容器验收仍无通过结果。

#21 首轮远端 CI `42570665833` 在 Gitleaks 下载时失败，check 和 audit 已通过，后续 verify 未执行。归档交接提交仍需自己的完整 CI 以及小葛的正式审查。 [归档 PR #21](https://github.com/zwh9616/campus-claw-plus/pull/21) · [首轮 CI](https://github.com/zwh9616/campus-claw-plus/actions/runs/42570665833)

2026-11-10 同步主干。小葛对 `0e5186e` 的归档审查 `5824764941` 已批准，该提交完整 CI `42570908807` 成功。随后 #22 的 `76f54cb` 经小葛批准 `5824765821`、完整 CI `42574431617` 成功，正常合入 `16211ca27e4933eed28ceceb0f9fdf44a4963da4`，整棵树与已审提交一致。GitHub 要求 #21 同步该主干后复验。 [#21 原审查](https://github.com/zwh9616/campus-claw-plus/pull/21#pullrequestreview-5824764941) · [#22 合入](https://github.com/zwh9616/campus-claw-plus/pull/22) · [主干复验](https://github.com/zwh9616/campus-claw-plus/actions/runs/42766929515)

主干 `16211ca` 的完整 CI `42766929515` 四段均退出 0。MySQL、backend、admin、frontend 四个镜像实际扫描通过，真实 MySQL 身份测试通过。 [主干 CI](https://github.com/zwh9616/campus-claw-plus/actions/runs/42766929515)

同步后，7 项需求、19 个场景、浏览器验收原件和 11 项运行与测试输入摘要均核对一致，90 个本地链接有效。OpenSpec strict 7/7、合同用例 9/9 和差异检查通过。#21 相对新主干的差异为归档与进度文档，归档状态按同步提交的完整 CI、实际批准和合入结果更新。 [漏洞库修复验收](../10/A/trivy-db-download-2026-11-09.md)

2026-11-10 小陈收口：小葛对同步后 `23eb59c7f089349325a36bfc35d2357c2c3037f6` 的实际批准为 `5838237099`，完整 CI `42767447268` 成功。API 显示 clean/可合并；小陈再次核对差异只含归档/进度文档、运行输入无差异且 `git diff --check` 退出0，绑定该 head 正常合入 `c01fb9ba61dbe603e4f42367071a12da69d84fe5`，没有绕过保护。`git diff --quiet c01fb9b 23eb59c7` 退出0，整树与获批版本一致；同一 main 的完整 CI `42779317047` 已 completed/success。01、02归档均已在主干，不等于长期环境部署、回退演练或发布完成。[当前head批准](https://github.com/zwh9616/campus-claw-plus/pull/21#pullrequestreview-5838237099) · [PR检查](https://github.com/zwh9616/campus-claw-plus/actions/runs/42767447268) · [合入后主干检查](https://github.com/zwh9616/campus-claw-plus/actions/runs/42779317047)
