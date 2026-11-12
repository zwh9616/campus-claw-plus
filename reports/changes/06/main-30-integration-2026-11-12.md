# 06 PR #30 合入与主干复验

2026-11-12，zwh9616（小张，AI辅助）。#30最终head `09ed9579097b9c9d4a01117739a4240fb174402f`获本人真实批准5871329620，完整CI43182721975成功，绑定预期head正常合入main `86f0ca3c3832962b0946434f1d99cc7377693840`；整树与获批head一致，无管理员绕过。

## 已通过的实际证据

- [PR最终原始artifact](main-30-integration-2026-11-12/pr-final-runtime-scans.zip)：GitHub artifact13926344889，SHA-256 `ab8ee2754cbcf603b405e2fd76021c2b70d271e0f2434569f592aba600c09f25`；回读gate四段全0、notRun为空，四实际镜像HIGH/CRITICAL全0。
- 干净main86f0ca3在Windows Node25.2.1/npm11.6.2、Docker29.8.0、Firefox144.0.2，执行`npm run verify:materials-browser -- --playwright <本机外部工具绝对路径>`退出0；真实默认HTTPS+MySQL双班五人18项通过，可信CA/SAN、教师上传、两名同班学生搜索/出处/正文/原字节下载、学生写403、外班404、刷新、双标签切班/退出清理与failed恢复，临时项目/卷/网络/NSS配置已清理。[浏览器原件](main-30-integration-2026-11-12/browser.json) · [运行与清理](main-30-integration-2026-11-12/runtime.json)
- 真实界面截图：[教师详情](main-30-integration-2026-11-12/real-teacher-detail.png)、[学生360](main-30-integration-2026-11-12/real-student-detail-360.png)、[外班404](main-30-integration-2026-11-12/real-other-class-404.png)、[处理失败](main-30-integration-2026-11-12/real-teacher-failed.png)。与终审114张mock压力截图分别留证。

## 主干首次失败与修复范围

主干CI43183326230首次退出失败，不能写成完整复验通过。[失败原始artifact](main-30-integration-2026-11-12/main-first-failure.zip)，GitHub artifact13926813081，SHA-256 `e0d6635bf72b8694fea75a76e9c7eb18e316aed75a136e5e448d0e465dd40ac9`。check/audit/secret-scan均0、四镜像实扫全0；verify在DB重启后的资料检查遇到`MF oversized request-line transport`。原件表明此前重放/原文/下载、2000非BMP查询200与2001码点400已执行通过，失败定位在超32KiB请求行的客户端传输阶段；原日志未记录具体底层错误，不宣称已证明某一网络根因。

为可靠观察网关提前拒绝，沿用受信任CA/SAN新建TLS连接，并发发送超限请求行及读取完整HTTP响应头，断言仍严格为414。写入失败、EOF、错误状态或不完整头本身不能当通过；不改Nginx缓冲、应用接口、认证或生产程序源码；测试进入构建上下文，实际制品仍重新构建实扫。修复随当前#31同步主干提交，作为阻断规约PR门禁的最小06测试修复，非05业务实现。

普通Go检查新增受控连接用例：服务端只读128字节就发送414并关闭，写端无法完成仍须读到真实414；200、无响应关闭、不完整414头均失败。移除414状态断言时错误200真实红1，恢复绿0；首次遗漏http测试导入的编译失败亦保留，[测试原日志ZIP](main-30-integration-2026-11-12/transport-test-logs.zip)。完整修复后gate与最终head/main CI结果在得到真实输出后补记，3.2及归档不提前完成。

修复候选a9212e0的本机原`npm run gate`已实际四段全0、notRun为空；新Go用例进入普通check，真实网关414在首次启动/DB重启/保留卷重建三次通过，原资料/身份/迁移/隔离恢复均保留，四实际镜像HIGH/CRITICAL全0。[修复门禁汇总](main-30-integration-2026-11-12/local-repair-summary.json) · [原始JSON ZIP](main-30-integration-2026-11-12/local-repair-gate.zip)。之后仅补文档/证据，最终head远端CI与合入后主干实绩以PR #31收口记录为准；不能把原main86f0ca3的失败改写成成功。

最终恢复：#31 ef3553f经小张批准5871577319及完整CI43185758473成功后正常合入main da8624c；整树一致，主干完整CI43186361938四段全0/四镜像实扫全0，新414三次通过。小张在干净da8624c再次完成真实HTTPS双班五人18项及清理，最终原始artifact与新截图见[合入主干最终复验](../05/main-31-integration-2026-11-12.md)。3.2现已满足，待小葛整理06资料阶段归档；原main86首次失败继续保留。
