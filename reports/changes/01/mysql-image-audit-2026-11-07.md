# 01 MySQL镜像独立扫描与终审阻断

小陈 / Kevcco（AI辅助）补充实测与阻断项，镜像专项审查绑定当前#14 head **a74bc0c50e52703429b0e034e0d7f6f1529e1b66**。扫描源版本为41e8ed2，已核对a74bc0c的默认Compose和隔离子包仍使用完全相同固定摘要，因此下述镜像结果适用于当前head；其余生产激活代码继续独立审查。

**MySQL固定摘要镜像扫描未通过：2条CRITICAL、33条HIGH，实际退出1。** 本次Windows使用官方Trivy 0.76.2，工具归档SHA256核对为691f737a7e5566a673c3a74dab9160552ec32101e953b659e5c77443d16dddb6；通过remote直接读取linux/amd64镜像，不依赖Docker守护进程。不跳过漏洞库、不忽略未修复项、不添加扫描豁免。

```text
trivy image --image-src remote --platform linux/amd64 --scanners vuln --severity HIGH,CRITICAL --exit-code 1 --no-progress --timeout 5m --cache-dir output/identity-image-audit/cache --format json --output output/identity-image-audit/mysql.json docker.io/library/mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902
```

扫描时间、漏洞库版本和原始JSON摘要见文末。两条CRITICAL是certifi的GHSA-6q48-6c7w-9gw2（报告修复2026.10.18）及gosu内Go1.24.6标准库的CVE-2025-68121；下表是扫描命中，不冒称已证明每条可在本服务利用。

请小张在既有01装配内核对当前固定镜像的可达性与修复：优先核对同版本安全重建的官方摘要或最小受审修复；若需改变已冻结MySQL版本，先同步现有01 runtime-plan及公共登记，不自行漂移latest。不得仅因“不是业务代码”整体忽略gosu/Python：现有mysql-entrypoint.sh确实委托官方entrypoint，需保留降权与初始化行为。修复后以同样扫描条件复测，并重跑TLS、迁移/初始化、停库恢复、卷重启及完整gate。当前扫描不覆盖未来生产后端/前端最终镜像，最终版本仍须补齐，不据此批准01。

另：#17已按保护合入main **7806b5d08741291b9c3de9ea0c5a1ab29c9c7870**，G3已共同登记，新main完整CI42359879443也已success。小张新交a74bc0c已实际激活生产身份入口，本次不再沿用‘未接线’描述。对齐最新main的只读merge-tree目前仅冲突README.md和docs/project-status.md，保留生产激活说明并整合G3实际状态。#15新head bd581ec已由小张据实收口样板2.3；真实页面与完整浏览器联验仍待完成。

| 严重性 | 漏洞ID | 包 / 镜像内目标 | 已安装 | 扫描报告的修复版本 |
| --- | --- | --- | --- | --- |
| CRITICAL | GHSA-6q48-6c7w-9gw2 | certifi / Python | 2026.2.25 | 2026.10.18 |
| HIGH | CVE-2026-69247 | cryptography / Python | 46.0.5 | 50.0.0 |
| HIGH | CVE-2026-69249 | cryptography / Python | 46.0.5 | 49.0.0 |
| HIGH | GHSA-537c-gmf6-5ccf | cryptography / Python | 46.0.5 | 48.0.1 |
| HIGH | CVE-2026-27459 | pyOpenSSL / Python | 25.3.0 | 26.0.0 |
| HIGH | CVE-2026-44431 | urllib3 / Python | 2.6.3 | 2.7.0 |
| HIGH | CVE-2026-44432 | urllib3 / Python | 2.6.3 | 2.7.0 |
| HIGH | CVE-2026-97687 | urllib3 / Python | 2.6.3 | 2.8.0 |
| HIGH | CVE-2026-97689 | urllib3 / Python | 2.6.3 | 2.8.0 |
| CRITICAL | CVE-2025-68121 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.24.13, 1.25.7, 1.26.0-rc.3 |
| HIGH | CVE-2025-61726 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.24.12, 1.25.6 |
| HIGH | CVE-2025-61729 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.24.11, 1.25.5 |
| HIGH | CVE-2026-111943 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.26.10, 1.27.3 |
| HIGH | CVE-2026-25679 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.25.8, 1.26.1 |
| HIGH | CVE-2026-27145 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.25.11, 1.26.4 |
| HIGH | CVE-2026-32280 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.25.9, 1.26.2 |
| HIGH | CVE-2026-32281 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.25.9, 1.26.2 |
| HIGH | CVE-2026-32283 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.25.9, 1.26.2 |
| HIGH | CVE-2026-33811 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.25.10, 1.26.3 |
| HIGH | CVE-2026-33814 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.25.10, 1.26.3 |
| HIGH | CVE-2026-33818 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.25.13, 1.26.6, 1.27.0-rc.3 |
| HIGH | CVE-2026-39820 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.25.10, 1.26.3 |
| HIGH | CVE-2026-39821 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.25.13, 1.26.6, 1.27.0-rc.3 |
| HIGH | CVE-2026-39822 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.25.12, 1.26.5, 1.27.0-rc.2 |
| HIGH | CVE-2026-39836 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.25.10, 1.26.3 |
| HIGH | CVE-2026-42499 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.25.10, 1.26.3 |
| HIGH | CVE-2026-42504 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.25.11, 1.26.4 |
| HIGH | CVE-2026-56853 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.25.13, 1.26.6, 1.27.0-rc.3 |
| HIGH | CVE-2026-56858 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.25.13, 1.26.6, 1.27.0-rc.3 |
| HIGH | CVE-2026-56859 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.25.13, 1.26.6, 1.27.0-rc.3 |
| HIGH | CVE-2026-56860 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.25.13, 1.26.6, 1.27.0-rc.3 |
| HIGH | CVE-2026-56862 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.25.13, 1.26.6, 1.27.0-rc.3 |
| HIGH | CVE-2026-78667 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.26.9, 1.27.2 |
| HIGH | CVE-2026-78669 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.26.9, 1.27.2 |
| HIGH | CVE-2026-97031 | stdlib / usr/local/bin/gosu | v1.24.6 | 1.26.9, 1.27.2 |

扫描元数据：实际开始时间 2026-11-07T09:27:45.7132944+00:00；耗时 25.8秒；DB schema 2，UpdatedAt=2026-11-07T06:54:25.084761873Z。完整报告原始字节SHA256=4557868fe25ddc395f22558d71a1e47b41a718f570f82d77050eca16fc537e1d，1456534字节；[gzip原报告](mysql-image-audit-2026-11-07.json.gz)解压后可重算，[结构化摘要](mysql-image-audit-2026-11-07.json)保留全部35项、包路径及数据库元数据。压缩往返已逐字节校验。

正式修改请求：[5811356408](https://github.com/zwh9616/campus-claw-plus/pull/14#pullrequestreview-5811356408)。本记录随原#14分支解决main 7806b5d冲突的提交入库；不把已有候选测试或小张自测当小陈对最终默认入口的独立复验。最终Docker复测待恢复登录；真实02浏览器链路未验证。

## 修复调查

2026-11-07再次读取Docker Hub官方8.4.13标签，摘要仍为本次失败摘要（last_updated=2026-11-03T02:02:53.12058Z），目前没有观察到同版本已更新的官方摘要。不得换latest。

[官方镜像构建文件](https://github.com/docker-library/mysql/blob/c92fbc392511086e6c1500f28a21421413f0bb51/8.4/Dockerfile.oracle)保留MySQL 8.4.13服务端，同时附带mysql-shell 8.4.10及gosu 1.19。九条Python命中位于usr/lib/mysqlsh/lib/python3.13/site-packages；26条Go命中属于实际用于entrypoint降权的gosu。可在现有01范围评估保留服务端版本、移除项目未使用的mysql-shell并使用受校验的新gosu/当前Go工具链的最小衍生镜像；须验证RPM依赖、官方初始化及降权不变，并重新扫描和真实TLS/迁移/初始化/停库/卷重建。仅删除包元数据或添加忽略项不能作为修复。此处为候选调查，尚未构建、未宣称修复。
