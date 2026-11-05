# PR #6 五项返修记录（小陈，2026-11-05）

## 绑定90374c1的二次复审

[小张二次正式审查](https://github.com/zwh9616/campus-claw-plus/pull/6#pullrequestreview-5786143149)确认R1凭据顺序、R2 CSRF恢复已在规约层通过，R3超时主修正及R4单实例双桶方案基本接受，但01整体仍为REQUEST_CHANGES。新[切班COMMIT不明意见](https://github.com/zwh9616/campus-claw-plus/pull/6#discussion_r4481386711)要求区分已确认回滚与确认包丢失；新[双桶容量意见](https://github.com/zwh9616/campus-claw-plus/pull/6#discussion_r4481386721)要求同时阻塞时等待取最大值、4095个桶需新建两个时原子拒绝。对应修订在design D3/D7及IDF-SC-12/19，新增Purpose供归档，不创建另一个01 change。

小张[逐项反馈](https://github.com/zwh9616/campus-claw-plus/pull/6#issuecomment-6659982126)接受版本/许可用途、Argon2id与初始化方案、候选迁移号、目标健康和七键用途，要求迁移DSN继承业务DSN的目标/证书校验，健康合同由小葛明确阶段切换。runtime-plan R1/R2/R3/R5/R6、design D8及PCR请求已同步；此为候选确认，不代替00原两人公共修订、01正式批准或实际依赖运行验证。当前PR描述中的旧main/G2、六键和10未交接需与本次提交同步更正。新提交及检查结果在PR回帖中绑定，不将旧CI冒称新head通过。

本轮本机用Node v24.22.1运行：OpenSpec全量strict 3项通过；合同检查22 Schema、82正反例、6语义输入、39接口示例及6组测试通过；foundation、全历史与暂存secret scan、audit（根和前端0漏洞）、diff检查均退出0。完整npm run check在backend因本机无Docker命令退出1；前序foundation/合同/类型/构建已通过，后续规约未由该串联命令执行但已独立通过。默认Node v20.12.2低于package要求，曾使合同检查报ERR_REQUIRE_ESM；改用符合要求的Node24重跑通过。未运行未来01身份代码、MySQL、HTTPS或npm run verify；新head CI须待推送后单独核实。

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

本地合入00后，用Node 24.22.1对工作树执行OpenSpec全量严格校验（3项通过）、合同一致性检查（22 Schema、82正反例、6语义输入、39 operation示例）、foundation检查及全历史/待提交secret scan，均退出0；`npm run audit`两处均无漏洞、退出0。本地未在01修订head完整运行`npm run check`和真实容器`npm run verify`；[PR #6的CI](https://github.com/zwh9616/campus-claw-plus/actions/runs/42035801865)已在`9ed12acf2d7680530dbd68baa0f7772038372c73`完成并成功，工作流含npm ci/setup/check/audit/secret-scan/verify。此CI是骨架/公共合同回归，不是未来01身份+数据库集成验收；最终文档同步提交的CI以该提交自己的运行状态另核。
