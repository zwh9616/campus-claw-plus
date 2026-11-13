# 小张审查05归档与精确主干复验（2026-11-13）

实际审查账号小张/zwh9616；原PR [#42](https://github.com/zwh9616/campus-claw-plus/pull/42)作者为小陈/Kevcco，审查基线cc8c665870d74b2116994e3f649690986039879a，集成基线main d06198de7cbff56b4304b3483aeec32ad9a3e085。按协作规范在原PR直接修正、验证及同步共享表，未创建重复归档PR；最终head实际批准与正常合入以GitHub记录为准，不将本报告当作另一成员批准。

## 归档核对与修正

- 独立逐字比对原delta、归档delta及主规约的全部8项Requirement、21个Scenario，规范化换行后正文SHA-256为42b2f5bf6883719271c8fdb2eaa3de999d31787fd8969c0f878ba4122411e3c7；提案完整移动，设计链接随目录迁移，tasks的真实阶段依据#38/#40/#41批准及主干证据。
- OpenAPI、端点登记、批次清单及精确合同断言仅将05来源路径迁至archive。业务代码、SQL、Schema/fixture、配置、镜像、Compose及锁文件未变；旧归档与第7课不倒改。批次05的#35/e617cc0仍是冻结合同准入来源，不冒称它交付worker。
- 修正主规约Purpose中“本归档候选仍待小张核对及合入”的临时状态文字，避免其长期留在主规约。8项规范条款及21个场景不变。作者报告保留为当时交接快照。后端/安全/部署规范仍将05称作“首批候选”、13 current/9 frozen，与已验收22 current冲突；本提交据#38/#40/#41既有事实同步当前状态，明确04目标4为历史，保留迁移/授权/租约及生产pending约束，未新增规则或改变运行输入。
- 实际回读#40批准5877403365绑定a485b94、#41批准5885799083绑定e59b57a；获批#41树与main d06198d树均为0c46acc490690816be0bca0d7bca1d9c0d4c4dc0。原PR #42无未解决审查线程。

## 独立原件核验

对作者保存的#40 main、#41最终PR、#41 main三个ZIP逐一计算摘要、校验CRC、四段门禁、四份源报告摘要、四份真实Trivy原文、四镜像扫描/运行关联和清理；另实际下载#42原head完整[CI43364043914](https://github.com/zwh9616/campus-claw-plus/actions/runs/43364043914)，GitHub artifact14009567811的ZIP SHA-256为fbeb907a92891b568d8c6ca490ec9e9ae39f30c2588c8ce199adcb6c4a07ee68，与下载字节一致。

全部门禁exit0且notRun为空，四镜像HIGH/CRITICAL均0，四项清理exit0。worker/最终PR/main真实MySQL测试无SKIP，至少14组TestAT通过；HTTPS登录与授权、数据库重启保留、全容器重建保留三个阶段均通过。配置缺失、非法端口、错误CA及数据库故障探针的非零退出为原规约负例，按精确标签/预期退出码核对，不误报为门禁失败。

[独立核验明细](zhang-archive/evidence-verification.json)包含每轮真实source、门禁、镜像ID、四报告摘要、清理、测试名和HTTPS阶段。[原#42 CI ZIP](zhang-archive/pr42-original-ci.zip)原样保存；作者三份ZIP位于[原归档报告](archive-review-2026-11-13.md)。临时下载URL与真实配置未入库。

## 今天本机干净main完整复跑

Windows Docker Desktop恢复后，在独立只读worktree上复跑精确main d06198d（工作树干净，Node v25.2.1，Docker29.8.0）。npm ci/setup退出0；原命令npm run gate四段check/audit/secret-scan/verify全部0，耗时分别49469/10551/21495/378109ms，notRun为空。运行输入指纹4559f8a99a1b828b204e877d61a2e36baee1daa3f642a3bd4856aa9f7d12bd02与主干CI一致。真实迁移/身份/资料/作业HTTP/原202/worker机制及默认HTTPS持久恢复通过；四镜像无高危或严重漏洞，运行ID与实扫ID一致，四项清理0。

[本机完整门禁原件ZIP](zhang-archive/main-local-gate.zip)包含十份原始门禁/运行/扫描报告及原命令日志。最初Docker daemon未运行导致check:backend失败，audit/secret-scan/verify未运行；[初次失败ZIP](zhang-archive/initial-docker-failure.zip)保留原日志及gate-results，不覆盖、不当作通过。用户恢复Docker后，上述干净main全量重跑已成功，没有重置Docker或删除其他项目数据。

## 本提交门禁与后续

本提交npm ci/setup、完整check/audit均退出0，strict10/10、根及前端0漏洞；独立检查220个当前变动Markdown本地链接有效，条款/路径/运行输入一致性通过。解包原件与新报告目录秘密扫描0；[检查原件ZIP](zhang-archive/reviewer-checks.zip)保留输出。全历史193提交及暂存秘密扫描均退出0，无新增豁免；[扫描原件](zhang-archive/reviewer-secret-scan.txt)。最终head远端完整CI、本人真实APPROVE、正常合入及新main复验必须分别核实，不提前记完成。

仅归档05已验收的基础。生产未绑定执行器/结果适配器，不claim且真实pending；未交付AI、成绩或作业页面，未升级持有人库。06作业页面需自身规约及批准，07B/08等仍需明确恢复和各自验收。
