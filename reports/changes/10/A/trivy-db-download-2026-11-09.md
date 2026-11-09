# 漏洞库下载恢复与扫描验证

基线为 main `2e8586a0958abda940139031069654d6077972ac`。此前在 Windows 本机验收 02 时，MySQL 扫描从 Google 镜像下载漏洞库，两次分别因 `unexpected EOF` 和下载超时退出 1。2026-11-09 探测 GHCR 与 ECR 时，完整下载也都超过原来的三分钟。GHCR 当次公开清单显示压缩层约 138 MB。 [此前失败记录](https://github.com/zwh9616/campus-claw-plus/blob/0e5186e4dc6f4fa3ba62f8156162579ef6549466/reports/changes/02/archive-review-2026-11-09.md) · [Trivy 官方库来源与更新规则](https://trivy.dev/docs/v0.76/guide/configuration/db/)

本次在 verify 内先准备漏洞库，再运行 MySQL、backend、admin 和 frontend 四个镜像扫描。每个工作区使用独立的库缓存，准备和扫描用同一把锁。Trivy 检查库的更新时间。镜像使用内存分析缓存，按 `HIGH,CRITICAL` 扫描并用非零退出和报告断言阻断。常规验收优先使用 GHCR，Google 镜像作为 Trivy 支持的备用源。慢网单独准备时优先使用官方 ECR，限时 15 分钟。gate 的 verify 总预算为 10 分钟，实际镜像扫描限时 3 分钟。

| 场景 | 实际记录 |
| --- | --- |
| DO-SC-04 取不到库时停止 | 在新工作区临时断开准备容器网络，`npm run verify` 退出 1，明确报告 MySQL 与应用扫描均未运行，随后恢复网络参数。 |
| DO-SC-05 同时准备 | 在一次库下载进行时启动第二次 `npm run prepare:scan-db`，第二次退出 1，错误指向 `trivy-db.lock`。 |
| DO-SC-03/04 及 IDF-SC-17 | 门禁顺序、失败退出和扫描报告断言测试共 15 项通过。本机 `npm run gate` 的 check、audit、secret-scan、verify 均退出 0。 |

较短的独立准备任务因实测速率不足，由小张停止本次专用下载容器后改用 15 分钟准备窗口。GHCR 长时下载仍遇到 `unexpected EOF`。切换官方 ECR 后，本机 `npm run prepare:scan-db` 完整下载约 185 秒并退出 0。原失败和中止输出留在本机 `output/`。#22 初始提交 `95264c1` 的远端完整 CI 从空缓存完成 GHCR 下载、四个实际镜像扫描及真实容器验收，四段退出 0。 [PR #22](https://github.com/zwh9616/campus-claw-plus/pull/22) · [初始提交完整 CI](https://github.com/zwh9616/campus-claw-plus/actions/runs/42573383309)

本机最终在 Windows、Node 25.2.1、npm 11.6.2 和 Docker 29.8.0 上执行 `npm run prepare:scan-db` 后运行 `npm run gate`。MySQL、backend、admin 和 frontend 均实际扫描，高危和严重漏洞各为 0。两段扫描记录的数据库元数据相同，库版本为 2，`UpdatedAt` 为 `2026-11-09T00:56:17.155719746Z`，`DownloadedAt` 为 `2026-11-09T06:34:29.653808597Z`。真实 MySQL、HTTPS、迁移、初始化、健康故障和重建后数据保留均通过。原件留在 `output/mysql-image-verify/`、`output/application-image-verify/` 和 `output/verification/gate-results.json`。本次候选尚需最新提交的完整 CI 和真实审查。
