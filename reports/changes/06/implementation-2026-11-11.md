# 06资料页面实现与自测交接

[PR #30](https://github.com/zwh9616/campus-claw-plus/pull/30)交小张/zwh9616独立终审。执行者：gjj6666（小葛），AI辅助。已完成本人的2.1—2.5；任务总进度7/9，3.1/3.2由小张负责，未代批准、未合并或归档。基线main1fa47ee已确认并合入样板#29，其主干CI43037165627成功。

## 实际实现

资料列表每页20、显式keyword检索top_k4、清除回第一页；三类受保护路由和工作台/导航入口，正常/加载/空/错误分开。查询留在内存和API请求中；公开/非法路径不发身份或资料请求，合法深链登录后回到原资料路由。

六个固定资料操作封闭在认证客户端中，Bearer不暴露页面，不接受任意外部URL。请求同源、no-store、禁止重定向、可取消且10秒截止；读取401最多同身份核验后重试一次，上传/处理重试/下载不自动重放。后台同身份刷新保留表单，切班/退出/跨标签变化清理旧内容和文件，迟到响应不回填或触发下载。

教师上传按码点/控制字符、文件字节/扩展名/严格UTF-8预检，浏览器生成multipart boundary且保留原始File字节。不确定结果由用户手动同键确认，更换内容须明确确认并使用新键；429倒计时后只允许手动重试。failed显示“已保存、暂不可检索”，教师可显式刷新/重新处理，学生只提供只读动作。

出处ID/规范URL/版本/Unicode码点须与授权原文匹配；正文转义并保留换行。原文件经Bearer取Blob后按material-ID命名，完成/离开/身份变化释放object URL；旧下载不能在切班后触发。没有新增后端业务路径、数据库、依赖或环境键，作业/AI/MCP/成绩继续按各自依赖推进。

## 验证版本与结果

最终运行源码：`14eefcf8bb3035214144ee9e906037c0d059a7df`。后续提交只补证据、状态和任务勾选，运行和检查输入不变。b3d52b1的8个前端输入与此版本逐项摘要相同，因此保留该版114张mock原始截图；真实HTTPS截图及最终门禁另在14eefcf干净源码执行，不把旧截图改写成新SHA。

| 检查 | 实际结果与原件 |
| --- | --- |
| npm ci/setup、类型/构建、前端检查 | 全0；原认证11项与新增资料15项共26项通过，均在原check入口。含非法输入/路由、码点/字节/编码、响应畸形、401单次恢复、写不重放、上下文/迟到响应、状态和原字节 |
| 生产路由HTTP mock | b3d52b1干净源码114张原始截图、6组交互通过；360×800/1440×900、767/768断点和原生200%（getZoom=2、DPR=2、布局180/720）无横向溢出。分页、四态、长内容、键盘、同键确认/新键、429、Blob释放、切班旧下载取消及师生权限均通过。[清单/文件指纹](implementation-mock-b3d52b1/manifest.json) |
| 实际计算样式 | 文字/placeholder≥4.5:1；输入边界3.632:1，placeholder4.608:1，焦点8.471:1且2px可见。使用真实元素的前景、背景、边界/轮廓样式计算，不以静态色板代替实测 |
| 写不重放的受控红绿 | 临时允许上传/下载401自动重放，真实断言退出1；finally原字节恢复，原认证+资料26项退出0。[完整输出](implementation-red-green-2ff02b9.json)，其客户端输入与最终版本一致 |
| 最终原完整npm gate | 14eefcf干净源码check/audit/secret-scan/verify四段全0、notRun为空，verify155653ms。Go vet/随机测试、合同正反例、类型/构建、生产样板隔离、strict9/9、资料/身份/迁移/真实恢复均保留；四实际镜像HIGH/CRITICAL均0。[最终汇总](implementation-gate-14eefcf.json) · [原始JSON ZIP](implementation-gate-14eefcf.zip) |
| 真实默认HTTPS+MySQL | 14eefcf干净源码Firefox142.0.1双班五人18项通过：教师上传、两名同班学生检索→出处/原文→原字节下载，学生真实写403、外班师生同构404、刷新恢复、真实双标签切班/退出清理，以及隔离库受控failed后通过真实UI恢复ready。[18项及信任说明](implementation-real-14eefcf/browser.json) · [默认Compose运行原件](implementation-real-14eefcf/runtime.json) |
| 真实截图 | [教师详情1440](implementation-real-14eefcf/real-teacher-detail.png)、[教师failed](implementation-real-14eefcf/real-teacher-failed.png)、[学生详情360](implementation-real-14eefcf/real-student-detail-360.png)、[外班404](implementation-real-14eefcf/real-other-class-404.png) |

Windows本机无GNU Make，实际执行npm原入口，远端Linux Make检查保留。真实浏览器仅在临时Firefox NSS配置中正常信任测试CA/SAN，明确验证错误SAN被拒，没有忽略TLS或修改操作系统信任库；测试项目/卷/网络和临时NSS配置均清理。fault注入只将本次隔离MySQL中的对应测试资料置为failed，随后响应来自真实后端；没有伪造真实浏览器HTTP响应。

## 最长查询缺陷与已完成修复

原网关对合法`q=𠮷×2000`返回414。开发首次失败[sourceDirty=true原件](long-query-414-red.json)按实际保留，随后在干净提交7ee112a再次复现，[受控红原件](gateway-red-7ee112a/browser.json)及[运行退出1](gateway-red-7ee112a/runtime.json)可追溯，未用早先普通流程预检代替边界通过。

用户已明确同意修订proposal/design/spec/tasks。已在D2a/D5登记唯一静态例外`large_client_header_buffers 2 32k`；不新增环境键、不改URL、认证、代理信任、数据库、查询2000码点上限或依赖。依据[Nginx官方说明](https://nginx.org/en/docs/http/ngx_http_core_module.html#large_client_header_buffers)，单条请求行须放入一个缓冲，增数量不能代替足够的单缓冲大小；此修复容纳约24KB的合法百分号编码请求行，仍保持有界。

14eefcf的真实Firefox绿结果：2000非BMP码点返回200和keyword JSON，2001码点应用400，超过32KiB请求行仍414。新断言已加入原`verifyMRWiring`，在最终完整gate的首次运行/数据库重启/全容器重建三个真实链路中均实际通过，未来CI可阻止这项回归。原失败和早期[未覆盖此边界的门禁](implementation-gate-2ff02b9.json)保留，不以CI绿灯代替真实浏览器或他人批准。

## 交接

小张按最终head独立复跑3.1，核对D2a例外、客户端/页面、真实双班五人和受影响视觉/认证回归，按流程直接修复。正式批准与远端强制检查满足后，才由有授权的负责人正常合入、复验main、完成3.2及归档；本次不执行这些动作，不把本机结果冒充另一成员或长期生产部署。

复跑：`npm run gate`；Windows真实浏览器另执行`npm run verify:materials-browser -- --playwright ABSOLUTE_EXTERNAL_PLAYWRIGHT_PATH`，准备匹配Firefox/Python；mock使用`node frontend/tests/materials-browser.mjs --playwright ABSOLUTE_EXTERNAL_PLAYWRIGHT_PATH --origin http://127.0.0.1:5197 --output output/material-browser`。浏览器工具不写入应用依赖，普通、mock、真实和远端CI证据分别记录。
