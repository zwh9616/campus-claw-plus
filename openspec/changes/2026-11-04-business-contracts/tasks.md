## 1. 00规约 小葛
- [x] 1.1 读取实际main 2bf12e2、手册v2与现有规则，核对健康响应/配置/历史证据；证据design.Context及reports/changes/00/。
- [x] 1.2 编写proposal/design/两项delta/tasks，明确字段、失败样本、各change门禁与规则迁移；证据BC-01..06/BC-SC-01..18和design D1..D9。
- [x] 1.3 执行严格校验与四类失败合同自审，保存命令/退出码/定位；证据reports/changes/00/spec-check.json。
- [x] 1.4 创建规约PR交小张审查，按实际结果更新docs/project-status.md；证据PR和当前head SHA。
- [ ] 1.5 小张对当前head审查及独立阅读的全部证据齐备（以下子项都完成才勾选）；不可由小葛代填。
  - [x] 1.5a 小张授权AI复审head 221be733194830daa9b35f810c37f035679e51bb，APPROVE 5765025797；BC-SC-11的G1已成立，仅允许00 apply。
  - [ ] 1.5b BC-SC-01真实无历史会话输入输出已在2026-11-05首次执行，结果未通过：错题订正路径缺项；[证据](../../../reports/changes/00/independent-reading-2026-11-05.md)。小葛补规约、小张审查后重新独立复验；执行不等于通过，按D8归档前须关闭。
- [x] 1.6 小葛按反馈修订221be73，小张复查R1—R6并确认关闭；严格校验2 passed/0 failed；真实批准见reports/changes/00/zhang-spec-rereview.md。G1依赖1.5a，1.5b仍为归档必验项（D8）。

- [x] 1.7 收到小张绑定旧head 0e9dda3的CHANGES_REQUESTED（R1..R6）；证据PR审查5764725986，不等于批准或BC-SC-01新会话。
- [x] 1.8 小葛完成R1..R6修订并逐项校验、交当前新head复查；证据修订对应表；独立于1.6的小张确认。

## 2. 00合同规则落实 小张
- [x] 2.1 G1当前规约批准后仅apply00，落实docs/contracts OpenAPI/Schema与正反例检查；引用可解析，非法字段/分数/ID拒绝；证据BC-SC-02/06；前置1.6。
- [x] 2.2 同步AGENTS、五规范、两campus技能、配置键登记和foundation检查，逐项关闭design迁移表；保留npm原门禁并采用OpenAPI3.1/2020-12单源一致性检查；证据BC-SC-09/10。
- [x] 2.3 对七类核查分别注明文档合同适用/不适用及下游责任；执行统一检查并受控破坏关键合同确认非零，恢复重跑；证据红绿输出、SHA和实现PR。

## 3. 00终审与下游准入 小葛 小张
- [x] 3.1 小葛终审小张实现PR当前head，复跑合同正反例、规则冲突和健康兼容检查；证据文件行号/命令/结果；前置2.1..2.3。
- [ ] 3.2 小张修复、小葛复查；遵守远端保护合并并在集成版本重验，证据齐后归档；不得引用历史一次性豁免；前置3.1。
- [x] 3.3 当天按真实状态更新进度、阻塞与下一责任人；G2前01/02/03/10仅起草，G3前所有业务实现PR禁止合并（10前置门禁自身例外），其他apply遵守design D8；证据BC-SC-12。

当前执行记录：[apply证据](../../../reports/changes/00/apply-verification.md)。2.1/2.2已落实；2.3合同红绿与七类核查完成，用户重启及本项目空网络清理后，18c3d08的完整check/verify通过，证据local-recovery-results.json和local-container-results.json。3.1已据小葛真实review 5782045346（head75cadbf）完成，限制见reports/changes/00/day-two-review-handoff.md；1.5b/3.2仍未发生，不提前勾选；3.3只表示本次如实同步，后续继续维护。

2026-11-05：用户授权后PR #3/#5已正常合入main，集成SHA 4cfd61d；main CI含check/verify通过。本机check因Docker引擎不可用退出1、verify未运行，未将远端结果代写本机通过。3.2包含归档，因1.5b及本机复验收口未齐仍不勾选；详见reports/changes/00/main-integration-2026-11-05.md。

恢复补记：用户重启Docker后，4cfd61d本机check/verify均退出0、15项容器验收通过，main CI也通过，G2成立。3.2仍含尚未完成的归档，1.5b独立会话未做，均保留未勾。证据main-integration-2026-11-05.md及main-container-results-2026-11-05.json。

独立阅读补记（覆盖以上“未做”历史状态）：2026-11-05新会话01a1ac13-9fed-7c11-bc36-50d08ff7d88c已对4cfd61d执行BC-SC-01，但因错题订正用户路径缺项未通过；已在PR #3评论6660380420交小葛补充。1.5/1.5b/3.2继续不勾选，保留真实失败，未改已批准机器合同或归档历史。

## 4. 独立阅读归档补缺（2026-11-06）

- [x] 4.1 小葛按用户确认补D0/BC-07及BC-SC-19/20，说明输入/保存/回看/状态语义及08/09/技能边界；首次独立阅读失败原文保留，不新增机器合同或代码。
- [ ] 4.2 小葛执行单项/全量strict、合同回归、差异和秘密扫描，记录真实结果并提交补缺PR交小张审查；检查成功不等于独立复验通过。
- [ ] 4.3 小张绑定补缺PR当前head审查，问题关闭后重新以无历史会话只给仓库和change名独立复验，保留实际版本及输入输出；1.5b/3.2仅在原必验项全齐时收口，不代填通过。
