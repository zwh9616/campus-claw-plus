# 10-B第二批：已验收05作业与持久任务运行覆盖

小陈/Kevcco（AI辅助）实现/自测，小葛/gjj6666逐批终审。基线main7f0f32f60e9edf805f4ae548896e330ec8d6e5c3，精确main完整CI43371464541已通过；#43最终dc18ea0获本人批准5886559717，获批/main树一致。05已验收主规约8项需求/21场景，G2/G3及自身依赖满足。历史main仅作准入，本批完整CI与小葛终审另核。

机器清单从05迁移#35更新为worker#41实际main d06198d及主规约路径；九个接口为current、worker机制已实现，生产执行器/结果适配器未绑定且不claim。保留四服务、十三active空键、Compose/网络/镜像/SQL/Target=5/原健康。修正原HTTPS测试日志“worker未实现”的旧文案，不改业务断言。

| 规约/场景 | 本次检查与真实范围 |
| --- | --- |
| DO-05 / DO-SC-11、13 | 更新实际来源和待接执行器；原配置/网络/限时探针/镜像摘要及秘密排除保持 |
| DO-SC-11、12 | 摘要要求原真实MySQL程序实际通过18个05顶层组（HTTP授权、幂等、worker竞争/恢复/取消/崩溃、迁移）；零退出但无PASS、SKIP/FAIL、前缀伪匹配均拒绝 |
| DO-SC-12 | 要求五个4/5旧新制品/备份/隔离恢复步骤以及实际备份Go测试PASS；缺项、非零或重复拒绝 |
| DO-SC-12 | 三阶段默认HTTPS均要求TestIDFWiring顶层PASS和05真实持久202/pending断言完成；只身份成功不能替代 |
| DO-SC-03、11..13 | npm verify保留原镜像扫描、默认Compose/HTTPS、真实MySQL三程序及失败传播；本批没有合成运行报告 |

已对真实摘要守卫作可恢复破坏：临时移除必需05组输出检查，Node测试实际退出1；finally逐字恢复后退出0。报告fixture只验证摘要拒绝规则，不冒称新增Docker/模型运行。完整本机gate及本批CI结果待实际记录。尚未创建PR，分支codex/10-b-assignment-batch；小葛终审和正常合入/main复验待办。B全量/C、AI/成绩/作业页面和持有人升级/长期部署均未交付。

## 本机真实结果

Windows，Node24.22.1/npm10.5.0/Go1.27.3；`npm ci`、`npm run setup`均0。完整`npm run gate`的check/audit/secret-scan均0，check含批次11项和strict10/10、npm根/前端零漏洞、历史201提交及暂存秘密扫描0；verify在准备Trivy数据库时因docker命令不存在ENOENT/-4058退出1，原镜像扫描/默认Compose/MySQL未运行，不记通过。[原gate](assignment-batch/gate.txt) · [gate明细](assignment-batch/local-gate-results.json) · [批次失败](assignment-batch/local-batch-results.json) · [安装](assignment-batch/install.txt) · [setup](assignment-batch/setup.txt)。

受控红绿为真实摘要守卫破坏，测试报告fixture只用于拒绝规则验证：[红1](assignment-batch/red.txt) · [逐字恢复绿0](assignment-batch/green.txt) · [摘要](assignment-batch/redgreen.json)。另用实际已下载的旧主干43371464541四源原件验证新摘要规则兼容，18个实际05组/三阶段HTTPS及备份均满足；仅兼容核对，不冒称本批真实运行：[边界记录](assignment-batch/historical-report-compatibility.json)。本批CI完整真实容器、自身最终head结果与小葛终审仍待实际执行。
