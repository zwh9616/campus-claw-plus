# 01 依赖来源与许可

版本来自已批准01 runtime-plan R1，具体校验和见backend/go.sum；源码vendor随本PR保留上游LICENSE/NOTICE/COPYING，未修改第三方源文件。

| 依赖 | 用途 | 版本 / 许可 |
| --- | --- | --- |
| github.com/go-sql-driver/mysql | 数据库驱动及可信TLS连接 | v1.10.1 / MPL-2.0 |
| github.com/golang-migrate/migrate/v4 | 编号/dirty/迁移互斥，mysql和iofs驱动 | v4.20.1 / MIT |
| golang.org/x/crypto | Argon2id口令散列 | v0.58.0 / BSD-3-Clause |
| filippo.io/edwards25519 | MySQL驱动的间接认证依赖 | v1.2.0 / BSD-3-Clause |
| golang.org/x/sys | Argon2运行平台支持 | v0.49.0 / BSD-3-Clause |
| 官方MySQL Community镜像 | 隔离真实数据库集成；生产接线另交 | 8.4.13，摘要见01 runtime-plan / GPLv2及上游附加声明 |

MySQL上游来源：https://github.com/mysql/mysql-server/tree/mysql-8.4.13 ，许可：https://github.com/mysql/mysql-server/blob/mysql-8.4.13/LICENSE 。本PR不把MySQL源码或二进制嵌入Go服务镜像；使用官方容器时保留其许可与源码获取路径。课程项目的许可选择已由#6确认，未来分发范围变化另审。

vendor是为保持原Go检查`--network none`及镜像构建可复现而提交。版本更新先改规约/锁文件，正常校验模块后运行go mod vendor；不得直接编辑vendor或关闭sumdb/TLS。govulncheck和镜像扫描当前未完成，失败原因见01实现报告，不能由版本锁定推断不存在漏洞。

上游LICENSE/README/Makefile含少量原始行尾空白；保留字节，不为本项目排版修改第三方源。`.gitattributes`仅对vendor关闭Git空白提示并标记第三方文件；Go vet/test、模块校验及秘密扫描仍包含相关内容，本项目代码不获豁免。
