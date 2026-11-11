# 前端实际镜像 libxslt 漏洞修复

小张（zwh9616，AI辅助）在04合同 [PR #25](https://github.com/zwh9616/campus-claw-plus/pull/25) 的完整门禁中遇到新的运行镜像阻断。基于 `5d794b9` 的 [CI 42970555936](https://github.com/zwh9616/campus-claw-plus/actions/runs/42970555936) 中check、audit、secret-scan均退出0，verify实际扫描MySQL/backend/admin均0，frontend扫描退出1。失败[扫描原件](https://github.com/zwh9616/campus-claw-plus/actions/runs/42970555936/artifacts/13832798026)已由CI保存，四个镜像原始JSON与results可回查。

| 漏洞 | 包 / 安装版本 | 扫描声明的修复版本 | 严重度 |
| --- | --- | --- | --- |
| CVE-2026-87636 | libxslt / 1.1.43-r3 | 1.1.43-r4 | HIGH |
| CVE-2026-9947 | libxslt / 1.1.43-r3 | 1.1.43-r4 | HIGH |

frontend扫描识别Alpine3.24.4、Nginx1.30.6-r1。已从[Alpine v3.24官方仓库](https://dl-cdn.alpinelinux.org/alpine/v3.24/main/x86_64/)及其APKINDEX核对libxslt1.1.43-r4，许可X11。frontend/Dockerfile用现有Alpine签名仓库精确安装该版本。基础镜像摘要、现有Nginx配置及服务入口保持现有版本；包下载或签名验证失败则构建非零退出。

这是既有门禁发现并直接修复的镜像依赖问题，按DO-SC-04/05及IDF-SC-17记录，修复随原PR验证。最终head需重新批准、实际四镜像扫描、可信HTTPS/身份容器回归及主干完整门禁通过。失败记录保留，最终CI/批准/合入版本见#25收口记录。本机Docker不可连接，因此本机镜像构建与容器回归未执行。
