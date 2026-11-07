# 01 MySQL镜像最小修复与实际验证边界

小陈接手原#14返修，保留小张773cd4b文档与证据，不强推；[窗口评论](https://github.com/zwh9616/campus-claw-plus/pull/14#issuecomment-6705251257)。原镜像35条HIGH/CRITICAL失败及正式修改请求保留，见[扫描记录](mysql-image-audit-2026-11-07.md)。

[构建与来源](../../../deploy/identity/mysql/README.md)保留MySQL8.4.13与官方基础摘要、原entrypoint，通过RPM移除未使用mysql-shell及载荷；原gosu1.19源码以Go1.27.3重建并保留LICENSE。没有增加漏洞豁免或改公共接口。默认/隔离Compose与真实身份验证用同一Dockerfile；独占标签/缓存卷避免并行干扰。

verify先验证实际版本、mysqlsh载荷移除和UID/GID降权，再以固定摘要Trivy扫描实际制品，HIGH/CRITICAL非零阻断且断言识别新gosu工具链，之后继续原可信TLS/迁移/初始化/卷重建测试。本机与CI均调用同一个verify；CI仅上传两份公开扫描JSON，不上传凭据、证书或源码tar。

本机完整check、npm audit退出0。原gosu源码已交叉编译成Linux ELF，以保留执行模式的单二进制镜像归档实扫0（识别Go1.27.3，HIGH/CRITICAL均0），该结果只覆盖gosu组件，不是完整MySQL或真实降权/数据库测试。首次Windows解压的非业务symlink失败、rootfs扫描未覆盖ELF的情况均留在[准备记录](mysql-image-fix-preparation-2026-11-07.json)，后者不计通过。

完整衍生镜像构建/扫描、默认Compose真实MySQL与迁移回归待本提交CI结果；独立最终Docker复测待恢复登录，最终前后端制品扫描及02真实浏览器链路仍未验证。本提交不标01终审/合并或归档完成，不把旧773cd4b绿CI算新Dockerfile通过。
