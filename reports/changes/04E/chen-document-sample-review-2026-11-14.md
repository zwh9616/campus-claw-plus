# 04E PDF/Word隔离样板 #49：小陈实际审查

小陈 / Kevcco（AI辅助），2026-11-14。审查小张的[PR #49](https://github.com/zwh9616/campus-claw-plus/pull/49)最终 `4acd495b40ef44e7affe023fe9921f2fdd532c49`。04E全部规约/实施/测试/收口仍小张负责；本人只记录自己的实际PR判断，不代用户确认产品方向，也不转移实施职责。

## 审查结论与实际合入

未发现阻断隔离样板入库的问题。通读DocumentSamples组件、CSS、samples入口、隔离脚本、浏览器检查脚本及同提交tasks/共享表。相对获审main39018c1，差异仅samples、隔离回归和文档/证据，生产HTTP/身份/TXT页面、合同/current、Target5、配置/Compose/镜像/SQL不变。样板不读取或发送文件字节，不调用身份/current/frozen API；React转义正文，Word按逻辑块，学生仅ready且直访非ready拒绝；待OCR、失败原因及三次重试上限均有明确视图。

最终[完整CI43563790405](https://github.com/zwh9616/campus-claw-plus/actions/runs/43563790405)成功且原件核验后，本人实际[APPROVED5902350597](https://github.com/zwh9616/campus-claw-plus/pull/49#pullrequestreview-5902350597)绑定该head，按保护正常合入main `670ac0c9ae587359bdba2c0d107be54b3ca1f0a9`，未强推或管理员绕过。精确main[完整CI43567519679](https://github.com/zwh9616/campus-claw-plus/actions/runs/43567519679)已实际completed/success，原件已下载核验，不用PR绿灯代主干复验。

## 本人实际检查与作者原件分列

本人启动当前提交的独立本地samples预览，在浏览器实际检查：列表检索“瞬时变化率”后转PDF第2页；手机上传空标题错误及焦点；学生仅两份ready、无上传入口，进入Word详情只显示逻辑块；360×800与1440×900两档四态/200码点长标题和256码点错误均无横向溢出、每页一个h1。该抽查为合成UI，不是真实身份/上传/解析验收，也未声称本人另跑作者全套原生200%批次。预览初次连接未启动的旧端口被拒绝，随后由本次独立端口正常复查。

独立[截图证据核对](chen-document-sample-review/browser-verified.json)：作者干净9317b81的92PNG/manifest ZIP SHA `221a3416c0eb44775fc43faa2d6c5c250a4033a5529f3b1730066a6bf92c90ac`，逐张SHA、三个代表图、九个当前UI/测试输入完全匹配；78视觉、6原生200%操作边界、9交互、零API/页面异常、对比度和两档/断点布局断言通过。学生ready筛选受控破坏实际红1→原字节恢复绿0，原失败输出仍在作者目录。原截图及受控红绿已随#49入主干，本收口不复制另一套或冒称新截图。

本人Node24.22.1/npm10.5.0/Go1.27.3：[合同40组](chen-document-sample-review/local-contracts.txt)、[类型](chen-document-sample-review/local-typecheck.txt)、[生产构建](chen-document-sample-review/local-build.txt)、[样板隔离](chen-document-sample-review/local-isolation.txt)及[audit两树](chen-document-sample-review/local-audit.txt)退出0。实际[完整check](chen-document-sample-review/local-full-check.txt)的Go/strict11/11等通过，到解析步骤因本机无Docker退出1，后置SQL未运行，未冒称本机完整gate或数据库复跑通过。[全历史/暂存秘密扫描](chen-document-sample-review/history-staged-secrets.txt)退出0。

## 最终PR完整CI原件

实际下载artifact14101507846，[原ZIP](chen-document-sample-review/pr-ci.zip) SHA `87656fb82f841b2c873f0afed6e3efd92a17d4c66bf8b92e08f4eaeb4032b1d4` 与GitHub digest一致，证据干净来源为合并预演4054282；预演与获批head整树相同。[运行核对](chen-document-sample-review/pr-runtime.json)四段gate0/notRun空、verify254633ms，四生产镜像零HIGH/CRITICAL、同轮运行ID/原报告摘要、四清理通过；[05核对](chen-document-sample-review/pr-assignments.json)保留18组真实SQL/worker、五恢复及三可信HTTPS持久pending，生产执行器/结果适配器未绑定。

[解析核对](chen-document-sample-review/pr-parser.json)保留40文档/25负例/195位置/45关键句、隔离候选同不可变镜像实扫及清理；[SQL合同核对](chen-document-sample-review/pr-storage.json)保留准确候选五表/六FK/十一CHECK、16个实际3819/1452/1062拒绝、Unicode8码点21字节、quote回滚及清理/秘密移除。两份解包[CI扫描](chen-document-sample-review/ci-raw-secrets.txt)/[截图包扫描](chen-document-sample-review/browser-secrets.txt)均0，无新增豁免。

## 收口与剩余依赖

本次在已有#50原分支同步样板main，逐块保留双方README/共享表以及#48、#49全部原件，补记实际批准/合入；不修改样板或生产代码，也不重复创建change。#50自身最终head检查与小张实际批准仍须满足，不能自审或绕过远端保护。

A3.1方向确认、真实Document接口/页面与A4全链路仍未完成，相关任务保持未勾。样板入库不授权直接假接frozen API；小张可按#48已满足的合同前置继续私有RPC、准确迁移6和真实中断/repair6/隔离恢复5，再进入持久HTTP及页面。A/B/C整体、10-B全量/C、AI/成绩/作业页面没有因本次合入放行。

## 实际精确主干复验

小陈实际下载artifact14102359005，[main原ZIP](chen-document-sample-review/main-ci.zip) SHA `3d9f0f00c0bea46c5fc726f92b4328650a6422042d67d4fdfe80df02a728ec15` 与GitHub digest一致；head及干净原件来源均为670ac0c，获批/main整树3b8515bcafe661c0666f290976d1b139dcb26431一致，protected=true。[实际批准/合入元数据](chen-document-sample-review/main-acceptance.json)及[收口评论](https://github.com/zwh9616/campus-claw-plus/pull/49#issuecomment-6873364474)。

[main运行核对](chen-document-sample-review/main-runtime.json)四段0/notRun空、四生产镜像零HIGH/CRITICAL/同轮运行ID/四清理；[05核对](chen-document-sample-review/main-assignments.json)18组SQL/worker、五恢复、三HTTPS持久pending；[解析核对](chen-document-sample-review/main-parser.json)40文档/25负例/195位置/45关键句、同候选镜像实扫/隔离/清理；[SQL核对](chen-document-sample-review/main-storage.json)准确候选DDL/16实际拒绝/Unicode/quote回滚/清理及秘密移除全部通过。解包[秘密扫描](chen-document-sample-review/main-raw-secrets.txt)0。运行未接入解析RPC或迁移6，样板仍不等于真实Document功能。

本次#50逐块解决文档冲突后，[foundation](chen-document-sample-review/closeout-foundation.txt)/[strict11/11](chen-document-sample-review/closeout-spec.txt)及新增[记录秘密扫描](chen-document-sample-review/review-record-secrets.txt)0，链接和diff检查通过；运行输入相对新main逐字一致。#50最终提交自己的检查及小张真实批准继续独立核对，未预填。
