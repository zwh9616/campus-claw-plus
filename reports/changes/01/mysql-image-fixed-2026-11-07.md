# 01 MySQL镜像实际修复与回归

小陈核对#14源head2a06bf8的[完整CI42361771890](https://github.com/zwh9616/campus-claw-plus/actions/runs/42361771890)，实际测试合并SHA为2adac99220d541f04618acb5522f5ac02fc5e2de，制品sha256:cb8af27e12f9e5d46d712c0d0515186cc7242accd8436622d683c2704c4da410。固定Trivy0.76.2扫描HIGH/CRITICAL均0、退出0；确实识别新gosu的Go1.27.3，真实UID/GID降权、MySQL8.4.13版本及mysqlsh载荷不存在断言均通过。[完整扫描压缩原件](mysql-image-fixed-scan-2026-11-07.json.gz)、[校验摘要](mysql-image-fixed-scan-2026-11-07.json)和[实际构建/扫描结果](mysql-image-fixed-build-2026-11-07.json)保留，摘要验证原始字节及gzip往返一致；漏洞数据库UpdatedAt为2026-11-07T06:54:25.084761873Z。

统一gate的check/audit/secret-scan/verify全部退出0；默认正式入口可信HTTPS与数据库TLS、证书错误拒绝、真实登录/撤销、数据库停机503/恢复、初始化重入不改口令、重建全部容器后原账号与口令仍可用，以及全量真实MySQL身份/迁移故障恢复回归均通过。命令里程碑见[CI绑定记录](mysql-image-fixed-ci-2026-11-07.json)。未声称这是小陈新完成的独立本机终审或原生浏览器联验。

原镜像35条命中、正式修改请求和首次5dc633d构建失败均保留，不将扫描/运行未到达的首次失败改成通过。当前继续补前端、后端及离线工具实际制品扫描；最终独立Docker复测需恢复测试环境登录，02真实页面/浏览器仍待小葛实现、小张收口。01整体终审/合并/归档未完成。
