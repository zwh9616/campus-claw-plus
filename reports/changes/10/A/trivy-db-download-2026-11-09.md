# 漏洞库下载恢复与扫描验证

基线为 main `2e8586a0958abda940139031069654d6077972ac`。此前在 Windows 本机验收 02 时，MySQL 扫描从 Google 镜像下载漏洞库，两次分别因 `unexpected EOF` 和下载超时退出 1。2026-11-09 探测 GHCR 与 ECR 时，完整下载也都超过原来的三分钟。GHCR 当次公开清单显示压缩层约 138 MB。 [此前失败记录](https://github.com/zwh9616/campus-claw-plus/blob/0e5186e4dc6f4fa3ba62f8156162579ef6549466/reports/changes/02/archive-review-2026-11-09.md) · [Trivy 官方库来源与更新规则](https://trivy.dev/docs/v0.76/guide/configuration/db/)

本次在 verify 内先准备漏洞库，再运行 MySQL、backend、admin 和 frontend 四个镜像扫描。每个工作区使用独立的库缓存，准备和扫描用同一把锁。Trivy 继续检查库的更新时间。实际镜像仍使用内存分析缓存，按 `HIGH,CRITICAL` 扫描并用原有非零退出和报告断言阻断。GHCR 优先，Google 镜像保留为 Trivy 支持的备用源。首次慢网下载可在验收前用 `npm run prepare:scan-db` 单独准备，限时 15 分钟。verify 的既有总预算与实际镜像扫描的三分钟时限保持原值。

| 场景 | 实际记录 |
| --- | --- |
| DO-SC-04 取不到库时停止 | 在新工作区临时断开准备容器网络，`npm run verify` 退出 1，明确报告 MySQL 与应用扫描均未运行，随后恢复网络参数。 |
| DO-SC-05 同时准备 | 在一次库下载进行时启动第二次 `npm run prepare:scan-db`，第二次退出 1，错误指向 `trivy-db.lock`。 |
| DO-SC-03/04 及 IDF-SC-17 | 现有门禁顺序、失败退出和扫描报告断言测试通过。完整运行结果待实际执行结束后登记。 |

较短的独立准备任务因实测速率不足，由小张停止本次专用下载容器后改用 15 分钟准备窗口。原网络失败和中止输出保留在本机 `output/`。
