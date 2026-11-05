# PR #6 五项返修记录（小陈，2026-11-05）

小张在[正式审查](https://github.com/zwh9616/campus-claw-plus/pull/6#pullrequestreview-5785063604)对`7fa3946`提出R1—R5。候选修订始于`b29f2be`，随后合入main `4cfd61d`以使用00生效机器合同，首次推送的修订head为`bdd0809ac8471bf52ea5d200df685a6b2c09fade`。已在原五条意见处逐条回复并重新请求`zwh9616`审查；回帖不等于审查通过或01获准apply。G2另依据00同SHA复验成立。

| 意见 | 对应修订 | 仍需确认 |
| --- | --- | --- |
| [R1 凭据优先级](https://github.com/zwh9616/campus-claw-plus/pull/6#discussion_r4480541535) | design D4及IDF-SC-13：Cookie/Bearer各自无效401先于Origin/CSRF；两有效但会话不一致403；refresh无Bearer；复合失败无业务副作用 | 小张复审同会话与错误优先级 |
| [R2 CSRF恢复](https://github.com/zwh9616/campus-claw-plus/pull/6#discussion_r4480541546) | design D3/D4及SC-04/05/12：从当前刷新凭证派生稳定高熵CSRF，GET重复/并发稳定，刷新/切班后新Cookie取新值，旧值拒绝 | 小张复审派生算法及多标签竞争 |
| [R3 DB超时](https://github.com/zwh9616/campus-claw-plus/pull/6#discussion_r4480541557) | D1/D8、runtime-plan R2及SC-18：明确不可达503、共用预算到期504；提交结果不明须核查，禁止盲重试 | 小张确认预算起点和故障注入判据；沿用00已有504 |
| [R4 限流](https://github.com/zwh9616/campus-claw-plus/pull/6#discussion_r4480541568) | D7及SC-19：源地址和用户名独立桶，精确60秒滑窗，429不计数，容量满拒绝，并发原子，单实例范围 | 小张确认阈值/容量与可信代理方案；多实例限额另审 |
| [R5 公共接线](https://github.com/zwh9616/campus-claw-plus/pull/6#discussion_r4480541572) | D8、runtime-plan R2/R5及PCR-IDF-01..03：00合入SHA、公共修订路径、版本/许可/迁移登记和01接线责任明确 | 00原两人审批新公共修订；小张确认候选与01规约，依赖未冻结前不apply |

对应回帖：[R1](https://github.com/zwh9616/campus-claw-plus/pull/6#discussion_r4480939870)、[R2](https://github.com/zwh9616/campus-claw-plus/pull/6#discussion_r4480940221)、[R3](https://github.com/zwh9616/campus-claw-plus/pull/6#discussion_r4480940600)、[R4](https://github.com/zwh9616/campus-claw-plus/pull/6#discussion_r4480940967)、[R5](https://github.com/zwh9616/campus-claw-plus/pull/6#discussion_r4480941358)，均引用`bdd0809`并请求复审。R5中对G2状态的[补充更正](https://github.com/zwh9616/campus-claw-plus/pull/6#discussion_r4480984465)已回在原线程；公共修订仍须00原两人另行批准，不能因回帖标关闭。

核对时main=`4cfd61d8119c51bc3bf2870a17c9754f0975b3dc`，PR #5已合入；[同SHA集成报告](https://github.com/zwh9616/campus-claw-plus/blob/29397750f3d6f8879b6aacdacbbe3e7d160ede3c/reports/changes/00/main-integration-2026-11-05.md)补充main CI及小张本机check/verify退出0，按00 D8的G2已成立。main有效规则仍为空，但这是10前置G3的待办；BC-SC-01及00归档仍待补。PR #7仍是`5e5f299`，待小葛修订；PR #8为02规约待审。没有修改00生效合同、Compose、真实配置或业务代码。

本地合入00后，用Node 24.22.1对工作树执行OpenSpec全量严格校验（3项通过）、合同一致性检查（22 Schema、82正反例、6语义输入、39 operation示例）、foundation检查及全历史/待提交secret scan，均退出0；`npm run audit`两处均无漏洞、退出0。完整`npm run check`和真实容器`npm run verify`未在这次修订head上运行，后续以PR当前head的CI与同SHA实测分别记录，不复用旧证据。
