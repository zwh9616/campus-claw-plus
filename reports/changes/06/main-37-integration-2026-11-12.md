# 06资料归档：PR #37 合入与主干独立复验

2026-11-12，小葛/gjj6666（AI辅助）。用户明确允许#37正常合入及主干复验；恢复执行时已读回该PR由小张/zwh9616完成合并，未重复合并或冒称本人执行。

## 实际来源

- [#37最终head ae64bb4](https://github.com/zwh9616/campus-claw-plus/pull/37) 已获小葛本人[真实批准5874954533](https://github.com/zwh9616/campus-claw-plus/pull/37#pullrequestreview-5874954533)，[PR完整CI43223400847](https://github.com/zwh9616/campus-claw-plus/actions/runs/43223400847)成功。
- 小张正常合入main **3c45f3187f9b37ab5abe8b4f3dc3079b2afb2f42**；实际merged_by=zwh9616，合入树与获批head同为797f77a8977d74bf793c86909819bf64822e8051。
- main protected=true，本会话未修改保护、强推或绕过检查。五项MF需求/十二场景已进入主规约，原四文件归档保留；原没有.openspec.yaml未补造，tasks重复附加段落已由受审提交清理。

## 精确主干的完整CI

[main CI43224927460](https://github.com/zwh9616/campus-claw-plus/actions/runs/43224927460) completed/success，check/audit/secret-scan/verify四段均0，notRun为空，verify166348ms。source.commit为上述精确main且dirty=false，未用PR测试合并SHA或历史绿灯冒充主干。

实际下载artifact13946909078，[原始ZIP](main-37-integration-2026-11-12/main-runtime-scans.zip)摘要与GitHub一致：`sha256:8668ebd94bcadcde1bb9b92a14004709e90c1ae9db3273666fe6140fa97d9e55`。四份源报告摘要逐项重算，沿用仓库原验证器核对四镜像HIGH/CRITICAL全0、运行与扫描完整ID一致、四项临时标签清理0。原容器程序实际执行HTTPS、数据库故障/恢复、身份资料与迁移隔离恢复；本次独立回读原件，不冒称另跑浏览器。

[实际批准/合入/文件树/原始摘要及验证事实](main-37-integration-2026-11-12/integration-facts.json)。

## 本机复查和界限

在独立干净main3c45f31工作树按锁执行npm ci、npm run setup、完整npm run check、npm run audit及npm run secret-scan，全部0；包含合同双路径/26组行为、批次8项、前端28项、类型/构建、Go vet/test及strict10/10，依赖审计0漏洞。[本机原始日志](main-37-integration-2026-11-12/local-checks.zip)。

相对86c9680的生产代码、脚本、Compose、镜像、SQL、依赖及机器合同无差异，批次仅06 spec索引移动。完整Docker gate本机本次未重跑；主干运行结论来自本轮真实主干完整CI，旧Windows124等记录不改写为成功。原工作树及ge-review32未提交修改完整保留。

06仅资料阶段归档已合入并复验；作业页面仍等05自身规约及真实接口。#38仍为独立候选，当前13 current/九个frozen/精确目标4，真实05业务、AI/成绩及10-B全量/C不因此完成。本轮把实际验收及冲突对齐放入原补证PR #39交小陈核对，不额外创建重复补记、不代其批准或合并#39。
