# 05规约及06门禁恢复：PR #31 合入记录

2026-11-12，zwh9616（小张，AI辅助）。小张逐项确认05 design D8、8项需求/21个场景及000005候选方案，在原PR直接修复同步main时发现的06超长请求行观测问题；原失败及本机完整门禁均见[06记录](../06/main-30-integration-2026-11-12.md)。

最终ef3553f376dd7f448b34950ec8aee100b0c5bd11获本人真实批准5871577319，[完整CI43185758473](https://github.com/zwh9616/campus-claw-plus/actions/runs/43185758473)成功，绑定预期head正常合入main **da8624cdb7793e64c4c3d29793b4c7a329adc2b8**；整树与获批head一致，没有管理员绕过或代填他人批准。

PR原始artifact13928556863已下载，[ZIP](main-31-integration-2026-11-12/pr-final-runtime-scans.zip)的SHA-256为`54cd5e9c6cbb22c237b1508964ccaca0906d8459bf8e511393e643fed108baeb`，已回读四段门禁全0、notRun为空、四镜像HIGH/CRITICAL全0；新414断言在三条真实链路执行。主干完整CI43186361938已实际completed/success。

05当前仅规约审定完成，tasks1.2据实勾选。九个操作仍planned、运行目标仍4，无新增SQL/服务/配置。000005只确认候选号与五表方案；1.3公共机器合同仍需小张提交、小陈审定合入，才可apply。原06资料实现和门禁修复不构成05作业/worker/AI运行成功。

小张在干净main da8624c再次执行`npm run verify:materials-browser -- --playwright <本机外部工具绝对路径>`退出0，Firefox144.0.2真实默认HTTPS/MySQL双班五人18项通过；源码sourceDirty=false、错误SAN拒绝、原字节下载/权限/跨标签/处理恢复及清理均保留。[浏览器原件](main-31-integration-2026-11-12/browser.json) · [运行/清理](main-31-integration-2026-11-12/runtime.json) · [教师1440](main-31-integration-2026-11-12/real-teacher-detail.png) · [学生360](main-31-integration-2026-11-12/real-student-detail-360.png)。与旧main86f0ca3证据分列，未覆盖原失败。

主干同SHA[完整CI43186361938](https://github.com/zwh9616/campus-claw-plus/actions/runs/43186361938)已成功。回读artifact13928284107的[原始ZIP](main-31-integration-2026-11-12/main-runtime-scans.zip)，SHA-256 `219c9bc110c2034ac13b311e0189db9dc9c99e85ecb68829fa4e72abb3f5be81`匹配；check/audit/secret-scan/verify四段全0、notRun为空，四实际镜像HIGH/CRITICAL全0，414新断言三次通过，真实身份/资料/迁移/隔离恢复均保留。[汇总与树一致性](main-31-integration-2026-11-12/summary.json)。06资料阶段3.2可据此完成并交小葛归档；05仍仅规约完成，公共机器合同未审定合入，作业业务未实现。

本次进度补记已对齐后续#32实际合入的main b4b13fd，逐行保留小葛10-B终审与小陈原始证据。小张另在#35提交05机器合同冻结候选，整合后f012c81本机完整gate全0/四镜像实扫/同轮同制品通过，仍待小陈实际审定合入，未apply。#34的B首批集成补记由小葛收口；本补记不导入#35未合入的合同代码。
