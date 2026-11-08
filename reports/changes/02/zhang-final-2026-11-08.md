# 02 小张独立终审与真实浏览器联验（2026-11-08）

本次基于小葛75ec2fd，先在#18以小张身份独立复测和修复Windows隔离验收地址池，CI42452735458通过并真实批准5816839413后正常合入main05965056098e6cb3b4d8411d62cbac482697b31c；该main完整CI42453041413成功。#15已通过5be7a79整合这一main，不覆盖身份、扫描、样板隔离或门禁检查。此次AI辅助小张复审，不冒充小葛/小陈的新批准或BC-SC-01独立新会话。

## 直接修复的两个缺陷

1. FEF-SC-07：跨标签通知到达时，externalChange复用尚未完成的旧me请求，旧班身份可能迟到回填。改为同步清除凭据、递增请求代号并取消旧请求，再执行一次串行恢复。新增独立测试在原代码退出1，修复后退出0；另临时关闭请求代号校验，测试退出1，逐字节恢复后退出0。原件见同目录此前的[初次复审](zhang-review-2026-11-08.md)及[红](zhang-late-response-red-2026-11-08.txt)/[绿](zhang-late-response-green-2026-11-08.txt)。
2. FEF-SC-05/08/14：真实多标签切班恢复后，共享HttpOnly Cookie已被另一标签刷新，但原标签仍使用缓存CSRF，退出被服务端403拒绝。改为每次合法退出或切班之前读取匹配当前Cookie的CSRF，仅提交一次原写请求，不自动重发不确定写操作。新增回归先红1后绿0；原7项及独立4项共11项通过。相关原有用例增加了明确GET csrf顺序断言，没有删除断言或放宽失败判定。

同步修正AGENTS、产品规范与README中“仍是静态首页”的过时当前状态；没有新增接口或改变身份公共合同，教学业务继续暂停。

## 实际执行与证据边界

输入版本是5be7a79加上述第二项修复；截图和浏览器执行时源码尚未提交，未伪称干净head。11个运行/测试输入的SHA-256见[source-manifest.json](zhang-final-2026-11-08/source-manifest.json)，最终提交应逐项相等。浏览器与mock均使用这一组页面输入。运行环境Windows、Docker Desktop29.8.0、Node25.2.1/npm11.6.2、Go镜像1.27.3。独立浏览器工具使用本机已有Playwright1.57.0-beta运行时，应用依赖未增加。

| 验证 | 实际结果与证据 |
| --- | --- |
| 独立认证测试 | npm run check:frontend-auth退出0，11项；共享Cookie缺陷红1/绿0原件[red](zhang-final-2026-11-08/shared-cookie-red.txt)、[green](zhang-final-2026-11-08/shared-cookie-green.txt) |
| mock页面与交互 | Edge157.0.4341.42，360/767/768/1440四档48态，24张截图；键盘/错误焦点/长ID/学生教师差异/无持久凭据均通过。[版本及清单](zhang-final-2026-11-08/mock-browser/manifest.json)明确sourceDirty=true，不算真实认证 |
| 真正HTTPS+MySQL浏览器 | Firefox144.0.2，默认Compose发布的127.0.0.1端口，campus.test正常证书链/SAN校验；12项全通过，见[JSON](zhang-final-2026-11-08/real-browser.json)、[运行输出](zhang-final-2026-11-08/real-firefox-final-check.txt) |
| 真实截图 | [学生账号360](zhang-final-2026-11-08/real-student-360.png)、[教师工作台1440](zhang-final-2026-11-08/real-workbench-1440.png)，均实际检查无横向挤出或重叠 |
| 既有原生200%与完整视觉 | 保留小葛909e1fb/75ec2fd的78页态及原生200%证据。App.tsx、app.css、sample-theme.css、styles.css与909e1fb逐字节一致，git diff --quiet退出0；本次只变认证客户端，未把普通截图放大冒充原生缩放 |
| 完整门禁和四个实际镜像扫描 | npm run gate四段check/audit/secret-scan/verify全部退出0；[gate JSON](zhang-final-2026-11-08/gate.json)、[输出](zhang-final-2026-11-08/gate.txt)、[真实接线](zhang-final-2026-11-08/wiring.json)、[数据库用例](zhang-final-2026-11-08/identity.json)、[MySQL扫描汇总](zhang-final-2026-11-08/mysql.json)、[应用扫描汇总](zhang-final-2026-11-08/applications.json)及四份*-scan.json.gz原件；实际镜像均0 HIGH/CRITICAL，无跳过、忽略或门限调整。原失败见[integrated-first-gate.json](zhang-final-2026-11-08/integrated-first-gate.json)与[wiring](zhang-final-2026-11-08/integrated-first-wiring.json)，不作为通过 |

真实浏览器12项逐条记录：可信入口、错误主机名拒绝、真实错密码与清空输入、教师登录、Secure/HttpOnly/Strict Cookie及不持久化访问凭据、重载恢复、另班学生无切班按钮、教师切班与旧访问凭据401、另一标签切班时真实旧响应不能回填、跨标签退出及再次访问受保护路由被拒、双班五人角色正确、两标签同时刷新分别200和401且失败方清身份。

真实测试未伪造身份响应。迟到GET测试通过Node HTTPS中继取得服务端真实响应，严格校验同一CA/SAN后仅延迟交付、不改响应正文；并发刷新仅在浏览器层同步放行两条真实POST，结果来自真实后端。其余链路直接由浏览器访问默认入口。测试使用隔离随机种子、DML/DDL分离、真实TLS、真实迁移初始化；未使用临时外部入口覆盖。隔离data/ingress/proxy网络在测试中选择空闲网段，生产Compose未改变；后台Origin明确匹配实际发布端口。

证书仅导入本次Firefox临时配置目录的NSS数据库；没有修改Windows信任库，没有ignoreHTTPSErrors、忽略SPKI或不安全HTTP。错误SAN同样被浏览器拒绝。成功测试结束后临时浏览器配置目录、专属数据库/卷/容器/网络已清理。此结果不代表持有人长期环境部署或另一机器验收。

## 失败记录与可复核性

首次集成完整门禁在重建网络时与同时运行的独立浏览器夹具争用同一空闲网段而失败；之后改为串行验证，保留失败原件。浏览器工具最初遇到配置目录信任准备失败、真实响应中继错误等失败，修正工具后重跑，不将失败算通过。延迟工具一次未捕获异常将隔离临时访问令牌写入本机忽略输出；已脱敏该输出并销毁对应隔离数据库/容器，未入Git。自动审批拒绝删除该次残留测试目录，未给具体理由；该目录保留在本机output忽略路径，不提交，不代表成功测试清理失败。

[工具原件](zhang-final-2026-11-08/browser-runtime.mjs)、[浏览器脚本](zhang-final-2026-11-08/browser-real.mjs)、[临时配置目录CA导入](zhang-final-2026-11-08/import-profile-ca.py)与[mock脚本](zhang-final-2026-11-08/mock-browser.mjs)保存实际执行版本。它们是本机复核证据，包含绝对工作树/既有Playwright路径；不是新增跨机器通用命令。执行时从output/review-02运行，#18工作树输入与整合main对应文件一致；其他机器需按本地路径准备工具，并保留其自己的真实结果。常规跨机器入口仍为仓库npm run gate。

4.1独立复跑与代码核对已完成，正式最终head批准仍待远端检查；4.2按上述事实完成；最终head CI、正式review、正常合入及main复验必须使用真实结果另记，不能预填。4.4归档继续待办。

提交扫描首次将source-manifest中两个以auth命名的测试文件SHA-256误判为API密钥，已逐项重算确认只是公开文件摘要。改用path与摘要分字段的条目结构，不加扫描豁免；同时记录实测Windows字节与Git规范LF字节的两种摘要。文本证据仅规范换行及去除行末空白，未改测试结果。最终全历史与暂存扫描均退出0，见[扫描记录](zhang-final-2026-11-08/staged-scan.txt)。
