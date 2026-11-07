# MySQL 8.4.13运行镜像的最小安全修复

基础仍为01批准的官方MySQL 8.4.13摘要，MySQL服务端、mysql/mysqladmin、原entrypoint、配置、初始化和持久卷协议不变。构建只做两件事：通过RPM移除本项目未使用的mysql-shell及其完整Python载荷；从未修改的gosu 1.19源码，用已锁定Go1.27.3重建降权程序。不会删除漏洞元数据、跳过未修复项、禁用TLS或用root代替mysql用户。

首次CI构建保留了“目录必须不存在”的断言，实际发现RPM卸载后仍留下mysqlsh目录，因此失败。修复在卸载后明确清理该组件的完整/usr/lib/mysqlsh载荷，再执行原断言；不删断言、不把目录残留当通过。

该修复针对[原镜像实测的35条HIGH/CRITICAL](../../../reports/changes/01/mysql-image-audit-2026-11-07.md)。仅提交Dockerfile不代表修复通过；`npm run verify`首先构建并扫描真实制品，随后在同一Dockerfile上跑默认Compose和真实MySQL身份/迁移回归。所有命令失败退出非零，本机与CI使用同一入口。

| 来源 | 固定版本与校验 |
| --- | --- |
| MySQL | mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902，8.4.13-1.el9；[官方构建源码](https://github.com/docker-library/mysql/blob/c92fbc392511086e6c1500f28a21421413f0bb51/8.4/Dockerfile.oracle) |
| gosu | [1.19 / 6456aaa0f3c854d199d0f037f068eb97515b7513](https://github.com/tianon/gosu/tree/6456aaa0f3c854d199d0f037f068eb97515b7513)，上游tag归档SHA256=cd9719b775dbfedae53923c9b0dc792b66d42c51e0b36652ed6f747fbadc0164；Docker ADD强制校验，不执行上游构建脚本，go.mod/go.sum和源码保持原字节 |
| Go | scripts/toolchain.json锁定1.27.3及官方镜像摘要；无CGO，保留可扫描构建元数据 |
| Trivy | 官方aquasec/trivy 0.76.2，sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb；[发布](https://github.com/aquasecurity/trivy/releases/tag/v0.76.2) |

gosu使用Apache-2.0，复制完整上游LICENSE至运行镜像/usr/share/licenses/campus-gosu/LICENSE；其来源和间接依赖仍可从归档及Go构建信息审查。MySQL基础镜像内许可与[服务端源码](https://github.com/mysql/mysql-server/tree/mysql-8.4.13)获取方式保留，课程项目许可范围沿用原批准；未来分发变化另审。

专门复测：`node scripts/verify-mysql-image.mjs`。使用独占镜像标签和扫描缓存卷，构建中及实际容器内断言mysqld版本、mysqlsh载荷不存在、gosu切为UID/GID999。Trivy通过导出的实际制品审计，不挂Docker socket，不传运行凭据；HIGH/CRITICAL任一命中退出1，同时断言新gosu确被识别为Go1.27.3。完整报告及元数据留在output/mysql-image-verify，CI仅上传该目录的两个公开扫描JSON，不上传源码制品tar、运行目录或证书。扫描不是漏洞可利用性结论。

真实降权/首次空卷初始化、可信TLS、迁移与六处DDL恢复、重复初始化、停库503/恢复、卷重建原账号保留，继续由后续现有verify断言验证；不以扫描替代数据库测试。当前正式终审结果以共享表和PR当前head为准。
