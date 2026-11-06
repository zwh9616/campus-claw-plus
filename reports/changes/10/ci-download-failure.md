# 10规约CI外部下载失败

版本：7a14db77e4adde3b804ce22a4038998c64a8908d；[实际run/job](https://github.com/zwh9616/campus-claw-plus/actions/runs/41998657873/job/127148426967)，2026-11-05。

npm ci、setup、完整check（含Go和严格规约）、audit均success；secret-scan在scripts/check-secrets.mjs:20下载官方Gitleaks8.30.1返回非成功HTTP响应，抛出Unable to download official Gitleaks release，退出1；真实容器verify被正常跳过。日志未提供具体HTTP状态，不能断言是限流或版本不存在，不能称为扫描发现泄漏。

本机使用相同固定版本/校验和的工具已对全历史及暂存扫描退出0，无泄漏；这不能替代远端失败结果。未改检查、URL、版本、摘要或跳过扫描。保留失败，在只补事实文档的新head上由原CI重新运行；后续结果按实际run记录，环境问题反复仍须交接，不放宽门禁。此失败不改变00已批准实现的审查结论，也不产生G2/G3。
