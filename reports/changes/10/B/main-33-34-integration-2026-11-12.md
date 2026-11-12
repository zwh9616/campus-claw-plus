# PR #33 / #34 实际合入与主干复验

执行人：小葛/gjj6666（AI辅助），2026-11-12。用户明确允许按现有保护合入#33/#34并复验；恢复执行时，两条PR已经由小张/zwh9616正常合入。本记录独立回读实际合入、批准和完整CI，不将同伴操作记成本人合并。

## 实际版本与批准

| PR | 最终head与实际批准 | 集成main | 主干完整CI |
| --- | --- | --- | --- |
| [#33](https://github.com/zwh9616/campus-claw-plus/pull/33) | bb7dd5e，小葛真实批准[5873502838](https://github.com/zwh9616/campus-claw-plus/pull/33#pullrequestreview-5873502838) | b6310659369ed760c18a68ac8c965b9eb4c6c6c9 | [43210635125](https://github.com/zwh9616/campus-claw-plus/actions/runs/43210635125)，success |
| [#34](https://github.com/zwh9616/campus-claw-plus/pull/34) | 568c1ad，小张真实批准[5873900783](https://github.com/zwh9616/campus-claw-plus/pull/34#pullrequestreview-5873900783) | 86c9680f927fcc26df9dfc565f9e0bb0b584be07 | [43212246246](https://github.com/zwh9616/campus-claw-plus/actions/runs/43212246246)，success |

小葛对#34旧9bbb5e5的批准5873506461已因后续文档冲突修复失效；不把它当568c1ad的新批准。小张在原分支保留双方原件、修复共享文档冲突及重复段落后，以本人账号完成最终批准与合入。两次集成文件树均与各自最终获批head一致；main protected=true，未由本会话修改保护、强推或重复合并。

## 独立核验的原始运行证据

两轮主干CI均为check/audit/secret-scan/verify四段退出0、notRun为空。source.commit分别绑定上述实际main且dirty=false；四份源报告摘要逐项重新计算，使用仓库原validateRuntimeEvidence再次验证，四镜像HIGH/CRITICAL全0、运行与实扫完整ID一致、四项临时标签清理全0。

- #33主干：verify174863ms，artifact13940668673；[原始ZIP](main-33-34-integration/main-33-evidence.zip)的GitHub摘要为`sha256:018408f99c7cd24ad02ec6dc70dc67a4c16549862f45b8b4cf8edeeb2670e669`。
- #34主干：verify159224ms，artifact13942331767；[原始ZIP](main-33-34-integration/main-34-evidence.zip)的GitHub摘要为`sha256:f8e6573648e1ac30966ff5b0970960a959b28137a1f24613278d078c979ae70b`。

原三个容器程序及真实HTTPS/数据库/身份资料/迁移恢复由对应CI实际执行；本次下载原件核验，不冒称本机重复执行或新的真实浏览器验收。[批准/合入/文件树/四段门禁与原始摘要事实](main-33-34-integration/integration-facts.json)。

## 本机精确主干复查

在独立干净86c9680工作树按锁文件执行npm ci、npm run setup、npm run check、npm run audit和npm run secret-scan，均退出0；包含合同双路径及26组行为、批次8项、前端28项、类型/构建、Go vet/test与strict10/10，根与前端审计0漏洞。[本机原始日志](main-33-34-integration/local-checks.zip)。

相对b63dfdd的生产Go/前端/Compose/脚本/依赖/Schema/端点登记无差异，批次登记仅已有reviewed状态。完整Docker gate本次未在本机重跑，主干运行结论来自上述实际主干完整CI；旧Windows600秒124及作者缺Docker的历史记录保持原义。原工作树及ge-review32中的未提交文件保留。

## 交接界限

#33/#34合入与实际主干复验已核清；B1.3第一批已完成。B全量4.1—4.4/C不提前勾选，05九个frozen仍不等于业务运行，当前13 current/目标4不变。06资料归档候选#37与05实现候选#38按各自真实审查处理，本记录不代其批准或合并。

本补记同步共享表10行并交小陈核对；不改变规约、功能、配置、SQL或运行门禁。
