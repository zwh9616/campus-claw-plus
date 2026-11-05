# 小陈对10规约的审查

## 新head 4fb1403复审（2026-11-05）

小葛已在design D5、DO-06/DO-SC-15和tasks5.2修正原P2：20样本仅作质量标记，19个请求全部5xx仍按100%错误率触发告警；20请求1/2个5xx、19/20样本500/501ms、0样本及依赖2/3次均有明确预期。我在隔离工作树对该head独立执行锁定OpenSpec全量strict，2 passed/0 failed、退出0；git diff --check退出0；没有运行尚不存在的真实告警。

当前[PR #7正式复审](https://github.com/zwh9616/campus-claw-plus/pull/7#pullrequestreview-5786421487)仍为REQUEST_CHANGES：head `4fb1403`与main `4cfd61d`冲突，GitHub该head没有check run，不能沿用旧head `5e5f299`的CI成功；已在[原意见位置](https://github.com/zwh9616/campus-claw-plus/pull/7#discussion_r4481603676)确认内容修复。请小葛同步main、逐行整合共享进度表、让新head CI成功，再交小陈绑定新head复审。G2已成立，但10自身规约未批准、G3未成立，不开始10 apply。

## 初审快照

审查人：小陈（Kevcco，用户授权AI辅助）；时间：2026-11-05 19:35（UTC+8）。

对象：[PR #7](https://github.com/zwh9616/campus-claw-plus/pull/7)，head `5e5f2997b0d17c35a675188eed493172be61732c`，基线main `2bf12e223e9a1e3bdd9044e32f7e8067df1f7afa`。已用Kevcco提交[正式请求修改](https://github.com/zwh9616/campus-claw-plus/pull/7#pullrequestreview-5784225566)，未批准规约，未apply。

## 审查范围与结论

已读proposal/design/spec/tasks、交接与历史CI失败说明，并对照安全/测试/部署规范、00已批准规约及依赖表、现有npm/CI/Compose/验证脚本。

A前置门禁设计已覆盖以下要求：

- G2与自身规约批准后才apply；A终审、main集成复验及保护证据齐备才G3，B/C仍待后续。
- npm是检查逻辑唯一入口，Make薄封装；G2后保留00 contracts与全部骨架断言，本地和CI覆盖一致。
- 安装、各子项、取消/信号/超时非零传播，未运行不记通过；并行隔离且仅清理本项目。
- 实际main保护、required check名称与来源、非作者批准及旧批准失效；权限或套餐不足记阻塞。
- 同head真实合同破坏与红CI、正常合并被阻止、逐字节恢复后完整绿和main复验；替身测试不能替代真实阻断。

当前head有1项P2规则冲突需小葛修订，详见下节。A设计已具备上述检查点，不等于本head已获批准，也不等于A已实现或保护生效。

## 请求修订：低流量告警规则必须统一

位置：[design D5第58行](https://github.com/zwh9616/campus-claw-plus/blob/5e5f2997b0d17c35a675188eed493172be61732c/openspec/changes/2026-11-05-delivery-observability/design.md#L58)，关联DO-06、DO-SC-15、tasks 5.2。

D5将20个样本作为p95/比例告警的前置，但[现行部署规范](../../../docs/standards/deployment.md)要求5分钟错误率>5%、p95>500ms或依赖连续失败3次时通知，没有低样本豁免。5分钟内19次请求全部5xx时，两者将产生相反告警结果。AGENTS要求规约与规则冲突先明确约定，例外登记到具体规范。

请小葛选择并写清单一合同：保留现行触发条件，20样本仅标记数据质量；或在具体部署规范登记经确认的变更/例外，说明生效阶段及范围。同步design/spec/tasks，给出低流量全失败、19/20样本、等于/超过阈值的明确预期，再交小陈绑定新head复审。小陈没有直接修改小葛规约或代其确认新阈值。

## 实际验证与前置状态

- 在目标提交隔离源码中，用OpenSpec1.13.0执行`validate 2026-11-05-delivery-observability --strict`，退出0；`validate --all --strict`退出0，2 passed/0 failed。
- 对比main与目标head，package、锁文件、CI、check-backend、verify和Compose均无实现差异；没有声称尚不存在的npm gate、Make或10保护实验已经运行。
- 目标head的[CI check成功](https://github.com/zwh9616/campus-claw-plus/actions/runs/41999372978/job/127150438647)，此前工具下载失败记录保留，未更改或放宽扫描。
- 实际main仍为2bf12e2，GitHub protected=false，有效规则列表为空；00实现PR #5虽已获小葛批准但未合入main，G2/G3尚未成立。规约审查可以进行，apply继续等待。
- 本审查带历史上下文，不是00要求的独立新会话；01工程Docker复跑也不充作10红绿或保护证据。

下一步：小葛修订上述冲突，小陈复审新head；只有G2、自身规约批准及前置齐备后才开始A实现，完成后交小葛终审。
