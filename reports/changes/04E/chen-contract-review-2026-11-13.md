# 小陈对04E首批公共合同的实际审查

审查对象：[PR #45](https://github.com/zwh9616/campus-claw-plus/pull/45)，小张/zwh9616提交的 `e02cbd6a7b7db25b2bff85037f22497412862503`。小陈/Kevcco 实际提交 [CHANGES_REQUESTED 5887416108](https://github.com/zwh9616/campus-claw-plus/pull/45#pullrequestreview-5887416108)，没有批准本候选。04E规约、合同、实现、测试及收口职责仍归小张；本记录只保存外部公共合同审查和交接，不转派实施。

## 已核对的范围与结果

原22 current操作、Target5、active配置及旧TXT/05运行链路保持；六个Document操作仅frozen，PDF/OCR/embedding没有进入运行。本机 Node24.22.1、npm10.5.0、Go1.27.3，完整 `npm run check` 退出0，严格规约11/11；本轮没有执行本机Docker集成，不把CI算成本机复跑。

已实际下载 [CI43382720058](https://github.com/zwh9616/campus-claw-plus/actions/runs/43382720058) 的artifact14017960101，ZIP SHA-256为 `ea5f61b5a72be1ac53018e290eea00b7c05d8934addd71eb04fad617b0fe4d06`，与GitHub摘要相同。四段gate均0、notRun为空；四源报告摘要匹配，四镜像零HIGH/CRITICAL且扫描/运行ID一致，四项清理0，原三阶段默认HTTPS/严格414回归保留。这些只证明本候选的合同检查和既有运行回归，不能代替新增文档解析或模型验收。[CI核验明细](chen-contract-review/ci-verified.json) 与 [本机检查原件](chen-contract-review/check.txt)。

## 实际复现的两项P2问题

1. DI-SC-02标题归一化：`validateDocumentUploadExample` 使用JavaScript `String.trim()`，与既有materials及Go `strings.TrimSpace` 的Unicode White_Space规则不一致。传入两端U+0085的合法标题被误拒；U+FEFF加200个“题”被误收，正确规范化后仍201码点，应拒绝。小张应复用Unicode White_Space归一化，保留非法Unicode/控制字符检查，并补两个边界反例。
2. DI-SC-02/12查询和分页声明漂移：对OpenAPI的内存克隆分别把document-search的 `q.schema.maxLength` 从2000改成2001，以及documents列表 `page.schema.minimum` 从1改成0，现有 `validateOperationBoundary` 两次均接受。小张应把q的类型、1..2000及字符规则、page的整数/minimum=1/default=1纳入精确检查，增加漂移失败测试并保留红绿证据。

[四次实际探针输出](chen-contract-review/probes.json) 只修改内存克隆和合成标题，没有改坏工作树合同或生产输入；当前完整check通过与上述缺口同时成立，不能用绿灯消除意见。

下一步由小张在原#45修正规约/合同校验与测试，同提交更新共享表，再对最终head完整检查并交复审。当前任务0.4和A apply前置保持未完成；不改勾真实PDF、OCR、向量或独立新会话。最终批准、正常合入与精确main复验仍须真实发生。本记录提交只增加审查证据和共享表，不修改04E实现。

本记录的foundation和64个本地Markdown链接已核对；全历史204提交及暂存内容秘密扫描均0，无新增豁免。上述完整check与CI绑定原审查head，补记提交的最终CI按后续实际结果核对，不提前记通过。
