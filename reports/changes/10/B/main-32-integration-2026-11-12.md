# 10-B 第一批：PR #32 合入与主干复验

执行人：小葛/gjj6666（AI辅助），2026-11-12。对应DO-SC-11..13及B1.3。用户已明确回复“允许合入并复验（推荐）”，本次授权覆盖PR #32；进度PR #33单独交接。

## 合入与版本

- 最终head `510e882c9f20f349c909fba7ceeaf84ecb8f9b88` 获本人[真实批准5872222879](https://github.com/zwh9616/campus-claw-plus/pull/32#pullrequestreview-5872222879)，[PR完整CI43192454795](https://github.com/zwh9616/campus-claw-plus/actions/runs/43192454795)成功。
- 按预期head和现有分支保护正常合入main **`b4b13fde47bf39f2d478ff6a2721df23a04680d9`**，merged_by=gjj6666；未修改保护或使用管理员绕过。主干与获批head文件树同为`9c58992145b8df0e930e547ee003191f706e41d4`。
- 本账号WRITE权限下，管理员级完整保护读取受限；实际main protected=true，批准前当前head check.isRequired=true且SUCCESS，仍REVIEW_REQUIRED/BLOCKED。沿用已记录G3管理员配置和当前实际约束，不将404/null/空规则读数说成无保护，也不声称已重新读取全部管理选项。

## 实际主干完整验收

[main CI43194409869](https://github.com/zwh9616/campus-claw-plus/actions/runs/43194409869) 对上述精确集成SHA执行原完整入口：check、audit、secret-scan、verify均0，notRun=[]，verify151759ms。批次source.commit为b4b13fd且dirty=false，源文件指纹与最终PR测试树一致。

四个实际镜像HIGH/CRITICAL全0；mysql/backend/frontend运行完整image_id与同轮扫描ID一致，admin也实际扫描并执行离线迁移。原三个真实程序均执行成功，可信主机HTTPS/CA/SAN、配置反例、3秒探针、DB停机health503/静态首页200、恢复及保留卷重建、真实资料/身份/迁移/备份隔离恢复通过；414在三阶段各重复10次，四个扫描临时标签清理均0。

下载并核对GitHub artifact13931299762：ZIP摘要`sha256:29596aba7789163b7980494244bb6391ac1e74173403e8652fda23582aa32a11`与GitHub元数据一致。[主干原始ZIP](main-32-integration-2026-11-12/main-runtime-scans.zip) · [CI事实](main-32-integration-2026-11-12/main-ci-facts.json) · [合入/树/授权及本机事实](main-32-integration-2026-11-12/integration-facts.json) · [PR最终原件](main-32-integration-2026-11-12/pr-final-runtime-scans.zip)。

## 本机主干复查与历史限制

在独立干净b4b13fd工作树执行npm ci、npm run setup、npm run check（含28项前端、批次8项、合同、Go及严格规约10/10）、npm run audit、全历史/暂存secret-scan，均退出0，根与前端审计0漏洞。[本机原始日志](main-32-integration-2026-11-12/local-main-checks.zip)。原ge-review32工作树及其未提交补记完整保留。

本次未把旧Windows完整gate的600秒网络超时124改成成功；此前关键运行补验0与完整CI成功分别保留在[独立终审记录](ge-review-2026-11-12.md)。上述“主干完整验收”指实际GitHub主干CI，本机仅声明本节亲自复跑的项目。

## 进度与交接

B1.3条件已满足，第一批01/02/04/06四服务完成终审、正常合入及主干复验。4.1—4.4全量及C继续待验，其他planned服务按各自前置逐批接入；没有将05规约批准等同于任务运行。

PR #33已有小张的#31/06主干验收补证并请求小葛审查，本次在该原分支整合最新main、关闭过时#32待审状态，保留其全部原件。小葛独立核对#31真实批准5871577319、CI43185758473/43186361938、两份ZIP摘要与四镜像结果、干净da8624c真实浏览器18项来源；05仍待机器合同冻结，06仅准备[资料阶段归档候选](../../06/archive-candidate-2026-11-12.md)。本次补记不执行归档或合并#33。

## 本轮进度PR复审

小葛/gjj6666（AI辅助）复审2808585至95a1565的三份纯文档变更，核对#35候选已提交及f012c81作者本机门禁原件、f253ae7历史完整CI成功；当前#35仍独立待小陈审定，未将它的合同代码或业务运行引入本补记。亲自复跑foundation、strict10/10及206个本地链接均通过，运行输入与b4b13fd仍无差异，旧2808585批准已撤销、不代替新head批准。

同时核对#34的原始artifact API摘要、四份报告摘要与同轮完整image_id，reviewed仅登记已经实际完成的第一批审查，批次8项/strict10/10通过；修正#34“05合同未提交”的过时交接。两份候选最终head各自通过CI后，分别以本人账号重新review；当前尚未取得合入#33/#34的明确授权，继续保留未合入状态，不扩大用户此前仅针对#32的合入授权。B全量/C、05实际业务与06归档仍按原前置待验。

## 同步已审主干e617cc0

审查期间#35已由小陈/Kevcco批准5872964547（head7fe5b5d）并正常合入main e617cc0，主干完整CI43202284398四段0；原始artifact13935334564及ZIP摘要已由小葛独立回读核对。原13 current不变，新增九个frozen只是机器合同，运行目标4、生产Go/前端/Compose/Dockerfile均未变，05真实实现仍待小张按2.x推进。

本分支逐块解决进度/任务文档冲突，完整继承该已批准主干的Schema/合同检查，1.3按真实批准与合入补勾；未删陈的耗尽反例或撤回任何冻结合同。旧b4b13fd原件继续只代表其实际版本，不冒充本次新head检查；本候选的最终CI及本人review按新head重新核对。B全量/C和06归档仍待验，合入本候选仍需当前明确授权。

本轮承接e617cc0后，亲自复跑合同双路径/26组行为测试0、strict10/10；206个本地文档链接均存在。#34额外批次8项0，后续完整CI/实际review仍绑定本候选新head。
