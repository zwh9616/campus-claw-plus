# 05 HTTP与worker独立审查检查点

执行人：小陈 / Kevcco（AI辅助），2026-11-12。此记录是审查检查点，尚非最终批准、合并或05整体验收。

## 本次源码与依赖

- main `fc5c2355d386739542dd75d25fd6154cf49575d1`：迁移#38已实际批准、正常合入，精确main完整CI43239351413成功；2.1原独立复测及跨库外键红绿证据保留。
- [#40](https://github.com/zwh9616/campus-claw-plus/pull/40) 最终读取head `08225e69bf2861b0dabcdabb91e4e8d49a553b3e`，原作者已解决与main冲突；2.2/2.3运行输入与其自测273223b逐路径无差异。本人本次未改业务代码。
- [#41](https://github.com/zwh9616/campus-claw-plus/pull/41) 预审head `c7f40f541c705dd652d3d423e6a58717ca1c5a6d`；仍依赖#40实际终审和合入，不提前批准。
- 四个本地未提交用户文件保持原样、未纳入提交。未复制真实配置或凭据。

## 本人已执行的核查

两份源码分别执行`npm run check`，均退出0，包括原基础/合同/前端/Go vet与测试/构建/strict（10/10）。#40另执行`npm run audit`、`npm run secret-scan`，均退出0；两个npm审计均0漏洞，全历史与暂存秘密扫描均0。本机工具：Node24.22.1、npm10.5.0、Go1.27.3 windows/amd64。本记录不将本机Go普通测试冒称带integration标签的MySQL运行。

代码核查覆盖AT-02/03的可信当前班级与逐资源授权、数据库事务内再次核对会话/成员关系、同快照分页、严格JSON/Unicode/版本、独立05配额、授权后查重且重放先于截止/配额、四类记录同事务提交以及丢失COMMIT回执后的查询重放。当前未发现已确认的新增阻断缺陷，仍需独立实际数据库复跑。

#41预审AT-04..08：有界轮询/并发、生产不绑定执行器、每轮Run随机owner、锁后数据库时间、owner/epoch/running/未过期条件、接管与ABA、全生命周期三次上限、取消先后顺序，以及任务/回执适配器/outbox同事务。读取了事务屏障、故障注入、真实子进程崩溃及SIGTERM测试；阅读与CI原件核对不等于本人独立执行这些用例。

## CI原始制品独立核对

| PR / 实际完整CI | API artifact | 下载ZIP SHA-256 | 干净CI集成源码 |
| --- | --- | --- | --- |
| #40 / [43241200428](https://github.com/zwh9616/campus-claw-plus/actions/runs/43241200428) | 13956280330 | 0fb64eea4a6de597db42f9830272a78d304e53f72f5c2a8e0672b4974f3d1a73 | c306a29c0eccaef0ce88ce2f98478cb2ddd4a043 |
| #41 / [43240598432](https://github.com/zwh9616/campus-claw-plus/actions/runs/43240598432) | 13955360670 | 5c87eda95619b570b41326636346a4988b6b783a6d4a0a19fb65f595ff9c3b90 | 8554a34b372a3d3fd5e05715cab6e9038102beea |

本人实际下载两个ZIP并重算，与GitHub API摘要匹配；校验四段gate均0、notRun为空、原四源报告摘要、当前服务登记、四实际镜像HIGH/CRITICAL均0、实扫/运行ID一致和四项清理0，均通过。原默认HTTPS三个阶段及每阶段10次严格414证据保留。#41 CI原始MySQL输出包含租约到期/ABA、退避耗尽、两种取消排序、终态/适配器回滚、真实子进程终止恢复和SIGTERM的成功记录。

两份CI运行的是GitHub的临时集成提交，分别以main fc5c235和上述PR head为父提交；它们不是已经合入main的证明。最终审查补记提交的CI仍须按新head另核，不能复用本表旧绿灯。

已额外比对临时集成提交与对应PR head的Git树，分别同为`c168e768df01621ec0c2cadf8956a029d64893c5`和`952a48010920c4a0c1687edcd682721cb216cfbc`。[本轮原件ZIP](chen-http-worker-review/checkpoint.zip)保留两份CI下载原件、两份源码的本机check、#40审计/秘密扫描输出及独立核验结构化事实，ZIP SHA-256为`02fa0750399d35a606887d74b15b51c22be08432f499aac864ab7798426d9740`。

## 尚未执行与下一步

本次独立Docker完整gate、真实MySQL/HTTPS权限与重放/恢复、#41关键CAS受控红绿及竞争/崩溃复跑尚未执行：需要恢复Docker测试环境临时SSH登录，已向用户提供临时公钥安装命令。真实凭据仅留本机运行环境；未把实现者自测或上述CI冒充本次独立复测。

授权恢复后先同步#40已提交源码至独立测试目录，独立复跑并留原件；最终head门禁、实际本人批准及远端保护齐备后正常合入并复验main。随后在原#41对齐已验收main，执行独立租约/竞争/终态回滚与完整门禁，再完成05的3.x及归档。测试后删除本次临时SSH授权。真实AI/成绩/作业页面和持有人长期部署继续由各自规约验收。

## #40 独立复测完成补记

上述待运行状态为授权恢复前的检查点。随后已恢复登录，将已提交文件同步至独立Docker测试目录；首轮文件内容验证完整gate四段0，因Git仍指向旧main且工作树有差异，仅保留为初轮结果。随后补齐实际Git对象，逐文件索引树等于`75c792f`的`1da5da652fc0a415342d972eb5e2d444538a5425`后更新本测试目录HEAD，工作树干净，再执行正式独立`npm run gate`。

正式结果：干净`75c792fa32ac83dfd7fbd9e9f2785a2fa3eab020`，Node22.23.4、Docker28.3.3、Compose2.39.1；check13236ms/audit3999ms/secret-scan1049ms/verify141136ms，四段退出0、notRun=[]。源码指纹`84e171915733e9fc97187bd727b746c8a2d49ec482860b1df07c1efa797eb6b8`与该head完整CI43244116670相同。独立检查四源报告摘要、四实际镜像HIGH/CRITICAL=0、扫描/运行ID相同和四项清理0，均通过。

真实MySQL六组业务/迁移回归通过，包括20并发同键等价JSON、截止相等/重放优先、四写点回滚、两种真实提交丢回执、同快照分页/大ID、失效/双班和同班他人隔离以及跨库FK漏拒回归。默认可信HTTPS正常、数据库重启、完整容器重建三阶段均通过，原会话/原submission/task/202快照与原答案持久化，生产Task保持pending/attempt0，无假成绩；原身份/资料/健康及实际4和5隔离备份恢复保留。

按AT-SC-07/21受控临时把同键异载荷拒绝改为接受，`node scripts/verify-identity.mjs`真实退出1；finally逐字恢复原生产文件后同命令退出0，工作树干净。失败原因来自HTTP409预期被错误202替代，未弱化测试、配额或事务。原件与结构化事实见[独立复测ZIP](chen-http-worker-review/http-independent.zip)，SHA-256 `b28d8c559df1394581c2d52cff52951822d1700966c9a6b443323b0b611198ac`；[解包原件秘密扫描0](chen-http-worker-review/http-independent-secret-scan.txt)。

本次补证仅改报告/共享表，运行输入不变。补证最终head完整CI、本人实际批准、正常合入及main复验仍据GitHub实时结果记录；不把#40这一批算作#41独立终审或05全量3.x完成。
