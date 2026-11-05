# PR #6 五项返修记录（小陈，2026-11-05）

小张在[正式审查](https://github.com/zwh9616/campus-claw-plus/pull/6#pullrequestreview-5785063604)对`7fa3946`提出R1—R5。下列为本次候选修订及待复审事项；本记录不表示审查通过、G2成立或01获准apply。修订提交号和真实命令结果以本次提交/回帖填写为准。

| 意见 | 对应修订 | 仍需确认 |
| --- | --- | --- |
| [R1 凭据优先级](https://github.com/zwh9616/campus-claw-plus/pull/6#discussion_r4480541535) | design D4及IDF-SC-13：Cookie/Bearer各自无效401先于Origin/CSRF；两有效但会话不一致403；refresh无Bearer；复合失败无业务副作用 | 小张复审同会话与错误优先级 |
| [R2 CSRF恢复](https://github.com/zwh9616/campus-claw-plus/pull/6#discussion_r4480541546) | design D3/D4及SC-04/05/12：从当前刷新凭证派生稳定高熵CSRF，GET重复/并发稳定，刷新/切班后新Cookie取新值，旧值拒绝 | 小张复审派生算法及多标签竞争 |
| [R3 DB超时](https://github.com/zwh9616/campus-claw-plus/pull/6#discussion_r4480541557) | D1/D8、runtime-plan R2及SC-18：明确不可达503、共用预算到期504；提交结果不明须核查，禁止盲重试 | 小张确认预算起点和故障注入判据；沿用00已有504 |
| [R4 限流](https://github.com/zwh9616/campus-claw-plus/pull/6#discussion_r4480541568) | D7及SC-19：源地址和用户名独立桶，精确60秒滑窗，429不计数，容量满拒绝，并发原子，单实例范围 | 小张确认阈值/容量与可信代理方案；多实例限额另审 |
| [R5 公共接线](https://github.com/zwh9616/campus-claw-plus/pull/6#discussion_r4480541572) | D8、runtime-plan R2/R5及PCR-IDF-01..03：00合入SHA、公共修订路径、版本/许可/迁移登记和01接线责任明确 | 00原两人审批新公共修订；小张确认候选，G2/01批准前不apply |

核对时main=`4cfd61d8119c51bc3bf2870a17c9754f0975b3dc`，PR #5已合入；main的该SHA CI成功，但远端main有效规则为空，尚不能以合入证明G2。PR #7仍是`5e5f299`，待小葛修订；PR #8为02规约待审。没有修改00生效合同、Compose、真实配置或业务代码。
