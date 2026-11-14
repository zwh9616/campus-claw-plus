# 04E A1后半私有接线合同：小陈实际审查

小陈 / Kevcco（AI辅助），2026-11-14。在原[PR #48](https://github.com/zwh9616/campus-claw-plus/pull/48)审查原head `944bfdfbf2853012c7bc9a37808cb38e79377940`，基线main9263d21。全部04E规约/实施/测试/收口仍小张负责，本次只记录自己的PR审查，不虚构其他成员批准或独立Docker复跑。

## 审查结论与边界

未发现阻断本合同合入的缺陷。本次通读私有OpenAPI/三Schema、配置登记、document-integration机器预算/顺序、候选五表SQL、候选探针/预检回归和规范对齐，检查以下边界：

- 私有两操作需Bearer，固定受控内部origin、无重定向/环境代理；闭合错误与状态、严格UTF-8/重复字段/surrogate/深度、10MiB请求/8MiB响应/2MiB正文及35秒RPC独立预算，未知位置/格式/状态拒绝。
- 认证及授权后先查已提交同载荷原202，再仅对新写预检解析依赖；依赖暂时不可用不能破坏幂等重放或原身份/TXT/ready读取，公开健康仍唯一真实MySQL Ping3秒。
- 候选原件/job/原202同事务，结果发布必须完整owner/epoch/processing/未到期租约及持久源回查；SQL长度/复合FK不能冒充逐字quote或跨行发布权威，未来实现责任明确。
- 五个准确候选DDL与摘要在docs，十份已发布SQL/manifest/Target5、22 current、13 active空样例、默认四服务/镜像/生产代码逐字保持。真实五步DDL中断、显式repair6、恢复Target5旧制品和20并发/kill/HTTPS/页面仍为未来实施门禁，未伪装成已执行。

本次只同步审查证据与共享表，不改合同、SQL、实现或检查脚本。原head与已测代码ed1c18f在源码/脚本/合同/SQL/配置/镜像上逐字相同。最终补证head自身CI、实际批准、正常合入与新main复验继续按实时结果核对；本提交不提前填写自己的SHA或批准。

## 本人真实检查

Node24.22.1/npm10.5.0/Go1.27.3：[npm ci](chen-integration-contract-review/local-install.txt)/[setup](chen-integration-contract-review/local-setup.txt)退出0；合同40组、基础检查、strict11/11及根/前端npm audit均退出0。随后实际执行完整npm run check：原合同/12项批次/身份/前端/类型/构建/Go/strict均通过，到check:document-parser因本机无Docker退出1，后置SQL探针未运行；[完整输出](chen-integration-contract-review/local-full-check.txt)。没有把本次部分检查说成本机完整gate或数据库验证通过。真实容器部分采用下述当前head完整CI及小张已有干净本机原件，来源分列；04E统一负责人例外不要求把CI冒称另一机器验收。

[合同](chen-integration-contract-review/local-contracts.txt)、[基础](chen-integration-contract-review/local-foundation.txt)、[strict](chen-integration-contract-review/local-spec.txt)、[audit](chen-integration-contract-review/local-audit.txt)已保存。本机未使用数据库凭据，原四份未跟踪文本保留；本轮93个本地链接、diff、全历史/暂存及新原件目录秘密扫描均实际退出0；未新增豁免。

## 当前原head完整CI独立核对

[完整CI43424153331](https://github.com/zwh9616/campus-claw-plus/actions/runs/43424153331) completed/success，head精确944bfdf，预演a4c0b31与head整树fd03ba5相同。artifact14037230710由小陈实际下载，[原ZIP](chen-integration-contract-review/reviewed-ci.zip) SHA-256 `236e445a01677c1b41734aa62583d5d3b1bef8e3f948845e815dd53d25f131c8` 与GitHub digest一致，所有16文件原件保留。

[运行核对](chen-integration-contract-review/reviewed-runtime.json)：四段gate0/notRun空，verify255310ms，原三程序全0；原报告摘要/同轮四镜像实扫与运行ID/四项清理通过，四镜像零HIGH/CRITICAL。[05核对](chen-integration-contract-review/reviewed-assignments.json)：18个SQL/worker组、五恢复步骤、三阶段主机可信HTTPS持久pending通过，生产执行器/结果适配器仍未绑定。

[解析核对](chen-integration-contract-review/reviewed-parser.json)：check/scan各40份清晰/25负例/195位置/45关键句、CER0、非root只读无外网及同不可变候选镜像实扫/两项清理通过，不计为第五个生产服务。

[SQL原件核对](chen-integration-contract-review/reviewed-storage.json)：来源绑定同一预演commit、工作树干净，MySQL8.4.13、14旧表/5新增/6FK/11CHECK及候选字节摘要匹配；16个拒绝用例实际退出1且分别3819/1452/1062准确匹配，其余步骤0。Unicode实测8码点/21字节；同长度错误quote只在回滚事务演示，原quote保留；两项自身容器/tag清理0、临时秘密文件已移除，SQL探针完成早于同轮verify，未拼旧报告。该SQL合同探针不是admin升级6/dirty修复/持有人恢复或实际RPC/持久worker验收。

解包原件Gitleaks0，[原扫描](chen-integration-contract-review/reviewed-raw-secrets.txt)。旧失败与两次受控红绿在小张[原报告](integration-contract-2026-11-13.md)保留，本次不删改、不加秘密/漏洞豁免。

## 下一步

本提交只补证；最终head完整CI、实际Kevcco批准、正常合入及精确main完整复验均须完成后，才解除小张按本合同推进私有服务/准确迁移6的阻塞。A1.2/A1.3实施验收部分、持久队列/六个公共HTTP/页面及整个A/B/C不提前完成。#49仍是独立样板草稿，方向确认和实际交付另验；10-B全量/C、AI/成绩/作业页面未放行。
