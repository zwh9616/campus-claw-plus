# 10-B第二批：实际批准、正常合入与精确主干复验

小陈 / Kevcco（AI辅助），2026-11-13。本记录只收口05运行覆盖这一批，B全量/C及10整体归档仍待各自准入。

## 实际审查与合入

小葛在原[#44](https://github.com/zwh9616/campus-claw-plus/pull/44)修复必需顶层Go PASS重复记录漏拒，保留18个SQL/worker组和三阶段HTTPS断言，并新增重复记录回归，真实红1→修复绿0；其干净44ef6ea本机完整gate四段0及首次网络失败原件见[小葛独立终审](ge-b2-review-2026-11-13.md)。这些是小葛的执行结果，不冒称小陈本机Docker通过。

最终head `497a3739d7ccbcfa93b4f13c6e7ea5a4557a479d` 获[小葛实际APPROVED5888919010](https://github.com/zwh9616/campus-claw-plus/pull/44#pullrequestreview-5888919010)。[最终完整CI43401884566](https://github.com/zwh9616/campus-claw-plus/actions/runs/43401884566) completed/success，artifact14025357955已由小陈下载，ZIP摘要 `c8e0038c78040bddaf0550f831c0d049bcd1e1191b91b96de4672411392b3971` 与GitHub一致；[原四镜像/运行核对](main44-integration/final-pr-runtime.json)、[05核对](main44-integration/final-pr-assignments.json)、[解析候选核对](main44-integration/final-pr-parser.json)均通过。

小陈实际阅读修复并本机复跑[12项批次检查](main44-integration/batch-recheck.txt)，12通过/0失败/0跳过，退出0。沿用既有授权，在保护规则满足后绑定该最终head正常合入main `47bcc6a4a7b8fcfc3b12faf91e6fffd68f4241bd`，获批/主干整树 `09fdc644430dc9cf050665a68c1e08a1cb84a6e6` 相同，protected=true，无强推或管理员绕过；[API原事实](main44-integration/main-integration.json)。

## 精确主干完整CI

[main完整CI43407716365](https://github.com/zwh9616/campus-claw-plus/actions/runs/43407716365) head精确47bcc6a，实际completed/success。artifact **14027609815** 已实际下载，[原ZIP](main44-integration/main-runtime.zip) SHA-256 `16408e0ce21a33238941694fc38032758e842821394b97e239349f615164e178` 与GitHub digest一致；源码记录干净且精确main，不用旧PR成功替代集成结果。

核验原check/audit/secret-scan/verify四段全0、notRun空，verify 280484ms；原三运行程序全0。四个默认生产镜像零HIGH/CRITICAL，原报告摘要、扫描/实际运行镜像ID和本轮时间相符，四项清理全0。[完整核对](main44-integration/main-runtime.json)。

18个真实05顶层SQL/worker测试组、五个迁移/4→5隔离恢复步骤、三阶段主机可信HTTPS的真实pending持久化全部通过；生产执行器/结果适配器仍未绑定，不制造批改成功。[05原件核对](main44-integration/main-assignments.json)。

继承#46的离线解析check/scan各8组，40份清晰文档/195位置/45关键句/25负例均通过，逐份CER=0，check/scan最长清晰单份分别1269/1290ms；非root、只读、无外网/临时目录清理与同不可变镜像测试→导出→实际Trivy扫描及两项清理均已核对，零HIGH/CRITICAL。离线候选不计为第五个默认服务。[候选核对](main44-integration/main-parser.json)。原始解包报告Gitleaks退出0，[扫描记录](main44-integration/main-raw-secrets.txt)。

## 本轮#47同步与边界

本记录随原#47合并最新main：仅解决共享进度表两处冲突，保留小张#46正式收口及逐字节相同的最终PR/main两ZIP，并明确其check1167ms/scan1159ms。生产代码、合同、迁移、Compose、镜像、12项批次守卫逐字节继承已获审main47bcc6a。B2.3据实际批准/合入/主干复验勾选；本提交自己的最终head CI/实际批准/合入与新main复验继续以实时结果核对，不预填。

原22 current/精确Target5/13 active空值键/四默认服务保持；没有持有人长期部署或库升级。04E全部实施仍由小张负责，下一步先冻结RPC/配置和准确000006再接持久HTTP/页面；A全链路/B OCR/C语义尚未完成。B全量/C、AI/成绩/作业页面不因此放行。

本轮文档合并工作树实际检查：foundation0、合同34组0、strict11/11、批次12项0、根/前端npm audit0；原件见本目录`main44-integration/pr47-*.txt`。未运行本机Docker完整gate，不把部分检查或CI称为本机完整通过。全部186个本地链接、diff及全历史/暂存秘密扫描均已实际通过，退出0。
