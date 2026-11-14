# 04E PDF/Word资料页样板

小张/zwh9616负责本轮规约、制作、测试和收口；不代填其他成员review或用户方向确认。对应已合入#45的D6、DI-SC-13和A3.1，不依赖仍待审#48的私有RPC/配置/准确DDL。基线main9263d21；#48最终944bfdf的完整CI43424153331及下载原件已核验，但本轮开工核对尚无成员review，未批准未合并，未apply其候选接线。原G2/G3成立，原22 current/Target5/active配置/镜像与旧TXT运行保持；未恢复作业页面、AI、成绩、OCR或语义实施。

## 设计计划及自检

保留已验06的高校教学资料语境：品牌#94070A、页面#F7F6F3、面板#FFFFFF、正文#272421、辅助#68615C、控件边界#8C8580，均引用现有CSS变量；使用系统中文无衬线，16px正文、14px辅助、20px区域标题、32/24px桌面/移动标题。桌面沿用200px侧栏与1120px正文上限，移动单列、44px控件、16px边距；主题和生产页面不改。

```text
资料标题 / 上传
文本资料 | PDF与Word资料
关键词输入 / 搜索 / 清除
列表：标题与ID → 格式 → 解析状态

详情：返回列表 → 标题 → 状态/格式/版本/原件下载
      页或逻辑块定位 → 转义正文；未ready时给出真实原因和可用动作
上传：标题 → PDF/.docx选择与限制 → 错误 → 上传/返回 → 提交后流程预览
```

对照设计简报后选择已有的分隔线列表与单一正文区域，不另做营销海报、统计卡片、状态仪表盘、远程字体或装饰图。辨识点放在“原始页 / Word逻辑块出处”，五种解析状态用文字说明下一步。品牌色/暖白虽为常见组合，但这是项目已批准的明确方向，不能另造主题。样板只展示文字，不嵌入PDF脚本、Office或公开文件URL。

## 本次实现边界

- `samples.html?page=documents|document-upload|document-detail`仅显式samples模式可用，入口有隔离合成数据横幅。生产入口及真实路由不导入新组件；没有fetch、身份读取、持久存储或FileReader/arrayBuffer，上传仅看File.name/size。
- 教师看到八项合成状态示例，学生只读两项ready；学生上传路径不展示表单，非ready/未知详情同一找不到说明。此为合成视图检查，不声称证明真实服务端授权。
- PDF按页、DOCX按逻辑块，关键词只匹配合成正文，结果直接回到匹配位置。正文/标题由React转义，长标题200码点、错误256码点，非BMP字符保留；两千码点搜索边界按码点计数。
- needs_ocr明确文字识别尚未接入，不提供假OCR按钮；失败只在可重试原因且未达三次上限展示重试。原件下载、刷新、重试仅演示入口，不伪造真实结果或请求。
- 上传校验标题200/201、空/不支持格式/空文件/10MiB+1与边界；合法后展示“流程预览”，明确未上传/保存，保留输入。签名、PDF页数、ZIP/XML及真实权限/流式字节由未来服务负责，未拿文件名验证替代真实解析。

## 当前验证与剩余项

已实际npm ci/setup、类型检查、生产构建和新增样板隔离检查退出0。浏览器首轮实际78视觉案例、9交互组、原生chrome.tabs缩放200%通过，无API/外部请求或页面异常。初轮实看发现Playwright fullPage在原生200%截图会裁切物理像素，布局度量仍正确；已沿用既有06策略改用CDP捕获真实浏览器视口，初轮原件保留，最终同版本截图另核。

外部Playwright只作为证据工具，不加入应用依赖；使用本机已有Chromium，版本/路径通过命令参数与manifest记录。`document-sample-browser-check.mjs`覆盖同源静态资源以外请求阻断、78案例、关键词与上传边界/保留输入、错误焦点、PDF出处跳转、Word无伪页码、五状态/终态重试限制和样板学生视图；初轮测试与截图不等于真实HTTPS授权或上传联验。

接下来：实际对照截图、关键学生过滤可恢复破坏红→恢复绿，干净提交浏览器复跑、原完整gate/audit/秘密扫描和最终CI；当前未预填。A3.1整体及A3.1b不勾方向确认，用户看过方向再接真实服务。#48和本样板各自真实远端批准/正常合入/main复验未完成，不绕过；A1.2b/A1.3b、A2.3以后、A4及B/C仍待办。

## 提交前实际补证（工作树dirty=true）

最终样板脚本本轮78布局/6原生200%主要操作可达/9交互组通过；[逐文件输入指纹与浏览器原件](document-sample/precommit-browser.json)、[输出](document-sample/precommit-browser.txt)。实际浏览器143.0.7499.4，外部工具1.64.0-alpha-1790635538000，未混称工具版本为浏览器版本；静态路径显式白名单之外请求和所有页面异常均为空。具体实际版本以manifest为准。

只临时移除列表学生ready筛选，真实浏览器断言八项不等于两项，退出1；组件逐字节恢复后完整绿0，见[红绿/指纹](document-sample/controlled-red-green.json)与[红输出](document-sample/controlled-red.txt)。这证明合成视图断言有效，不冒充服务端授权测试。

初轮原生缩放的Playwright fullPage物理截图裁切[原件](document-sample/initial-zoom-capture.zip)保留；改用既有06 CDP真实视口截图。新增严格可达检查另发现nearest滚动在200%下的设备取整令底边450.078125略超450，见[原失败](document-sample/scroll-rounding-failure.txt)；仅将测试滚动方式改为center并等两次动画帧，完整边界断言保留不放宽，6例再过。实际逐张查看桌面列表/PDF正文/Word逻辑块/手机上传/学生列表/200%主操作，未见横向溢出或遮挡；不代表用户已确认方向。

完整门禁将以干净代码提交执行；当前未预填。公开同日Trivy DB从既有已验收缓存只读复制到本新工作树独立卷，源/目标SHA均15982ae74263f22790b348c89b181c9edfd21d70b08b2364aedcf0f7ef8fab29，NextUpdate仍有效；[来源](document-sample/database-cache-provenance.txt)。正常扫描仍允许更新、无skip/漏洞忽略，仅操作自身临时项目，不碰现有预览或持有人数据库。

## 2026-11-14收口：已执行结果与主干同步

#48最终77f956f获小陈/Kevcco真实APPROVED5901659072后正常合入main39018c1，精确main CI43557491212实际success；小陈另在#50补主干原件。本样板#49原分支同步此main，README及共享表冲突逐块保留双方事实，未覆盖同伴审查/合同或其他负责人行。旧“#48未合并”文字属于11月13日开工快照，当前前置已解除。

原代码9317b81干净完整gate四段0，check127956ms/audit13804ms/secret12038ms/verify389550ms，notRun空。[本机15文件原件](document-sample/local-runtime.zip) SHA f9c027a33ff05a51d83edd0750af8e9a3fdc3d405571ed605e0ce6483371f98e；[运行核对](document-sample/local-runtime-verified.json)/[解析核对](document-sample/local-parser-verified.json)。[完整CI43433147376](https://github.com/zwh9616/campus-claw-plus/actions/runs/43433147376)实际success，[15文件原件](document-sample/ci-runtime.zip) SHA4d06fd74daaae52a5c74777374cf3cd8dd48386b95bdda3c5de390933acf350f等于GitHub artifact14043395035摘要；[运行](document-sample/ci-runtime-verified.json)/[解析](document-sample/ci-parser-verified.json)独立核验四段0/verify264450ms、18组05/五恢复/三HTTPS、四生产镜像+离线候选零HIGH/CRITICAL、40清晰/25负例/195位置/45关键句及全部清理。此轮早于合入#48，不含其新增SQL探针，不混称为新main全检查。

同一干净9317b81浏览器78视觉/6原生200%可达/9交互组通过，零API/外部请求与页面异常。[浏览器manifest](document-sample/browser-manifest.json)、[92张原始PNG与manifest](document-sample/browser-screenshots.zip)、[每图SHA及封包摘要](document-sample/browser-proof.json)，ZIP SHA221a3416c0eb44775fc43faa2d6c5c250a4033a5529f3b1730066a6bf92c90ac。已实看[桌面列表](document-sample/list-desktop.png)、[手机上传](document-sample/upload-mobile.png)、[PDF正文](document-sample/detail-desktop.png)、Word块及原生200%操作截图。此次主干同步后九个UI/测试输入逐文件SHA与截图manifest仍完全相同，不冒称为新截图或另一机器。

本提交同步主干并补原件/进度，合并后完整check/audit/秘密扫描及自身最终CI按实际结果另核。#49由草稿交审，不代表批准或合并；用户样板方向仍未确认，A3.1/A3.1b不勾，不接真实页面。下一步小张可依获审主干实施私有RPC/真实迁移与恢复，持久队列/上传HTTP随后推进；本批仍非A全链路或B/C交付。

11月14日本次复验：audit根/前端均0、全历史215/暂存秘密扫描0、CI原件解包秘密扫描0；合并后check在缺Docker engine的Go步骤退出1，[原失败](document-sample/merged-check-docker-unavailable.txt)保留，不标为完整通过。已按实际安装路径启动Docker Desktop，恢复后重跑；该环境变化不改写11月13日干净完整gate成功。

Docker29.8.0正常恢复后，合并工作树原完整check重跑退出0，合同40组/strict11/11/类型/构建/Go与隔离解析和真实SQL候选均通过，[重跑输出](document-sample/merged-check-retry.txt)、[候选SQL报告](document-sample/merged-ddl-results.json)。这是合并工作树dirty=true的提交前检查，不把它冒称新的干净完整gate；运行源码/配置/镜像/SQL均继承获审main，样板九个输入与干净截图版本仍逐字一致。补证提交自身完整CI推送后核对。
