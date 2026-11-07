# 01 依赖来源与许可

版本来自已批准01 runtime-plan R1，具体校验和见backend/go.sum；源码vendor随本PR保留上游LICENSE/NOTICE/COPYING，未修改第三方源文件。

| 依赖 | 用途 | 版本 / 许可 |
| --- | --- | --- |
| github.com/go-sql-driver/mysql | 数据库驱动及可信TLS连接 | v1.10.1 / MPL-2.0 |
| github.com/golang-migrate/migrate/v4 | 编号/dirty/迁移互斥，mysql和iofs驱动 | v4.20.1 / MIT |
| golang.org/x/crypto | Argon2id口令散列 | v0.58.0 / BSD-3-Clause |
| filippo.io/edwards25519 | MySQL驱动的间接认证依赖 | v1.2.0 / BSD-3-Clause |
| golang.org/x/sys | Argon2运行平台支持 | v0.49.0 / BSD-3-Clause |
| MySQL Community运行镜像 | 默认服务与真实数据库集成使用同一衍生Dockerfile | 8.4.13，官方基础摘要不变，见01 runtime-plan及[构建说明](../deploy/identity/mysql/README.md) / GPLv2及上游附加声明 |
| gosu | 保留官方entrypoint的UID/GID降权 | 未修改的1.19源码，以已锁Go1.27.3重建 / Apache-2.0；原LICENSE随镜像保留 |
| Trivy（仅验证工具） | 本机/CI共同verify入口审计实际MySQL、backend、admin、frontend制品 | 0.76.2官方镜像固定摘要 / Apache-2.0，不进入生产镜像 |

MySQL上游来源：https://github.com/mysql/mysql-server/tree/mysql-8.4.13 ，许可：https://github.com/mysql/mysql-server/blob/mysql-8.4.13/LICENSE 。本PR不把MySQL源码或二进制嵌入Go服务镜像；使用官方容器时保留其许可与源码获取路径。课程项目的许可选择已由#6确认，未来分发范围变化另审。

vendor是为保持原Go检查`--network none`及镜像构建可复现而提交。版本更新先改规约/锁文件，正常校验模块后运行go mod vendor；不得直接编辑vendor或关闭sumdb/TLS。govulncheck最终退出0：无受影响调用/导入包，1项未导入的openpgp模块提示详见reports/changes/01/go-vulnerability-audit.md。原官方MySQL镜像实扫失败（2 CRITICAL/33 HIGH），见[完整证据](../reports/changes/01/mysql-image-audit-2026-11-07.md)；最小衍生修复已在2a06bf8的完整CI真实扫描/数据库回归通过，见[修复实证](../reports/changes/01/mysql-image-fixed-2026-11-07.md)。随后2ec6668的完整CI42362608142确认四个实际制品均0 HIGH/CRITICAL；原Nginx基础另有1 CRITICAL/6 HIGH，使用官方同1.30.6安全重建固定摘要，工具链登记同步。独立最终Docker复测、02真实页面和整体验收状态仍见共享表，扫描通过不等于版本已发布。

上游LICENSE/README/Makefile含少量原始行尾空白；保留字节，不为本项目排版修改第三方源。`.gitattributes`仅对vendor关闭Git空白提示并标记第三方文件；Go vet/test、模块校验及秘密扫描仍包含相关内容，本项目代码不获豁免。
