# 04E 持久队列组件 — 2026-11-14

执行：小张 / zwh9616（AI辅助）。基线为已验收 `main97f25b9`；#51实际批准5903073379、main CI43575033114成功。#52 Go RPC客户端最终79adef5的CI43579234863成功，但本轮开工无review，未把它合入本分支或生产。依据已获审#48的I3与DI-03，独立实现队列组件。

## 实际改动

`internal/documentqueue`提供原件、queued作业、原202字节快照同事务；用户锁与二进制作用域键处理并发/异载荷，长度前缀摘要绑定格式、规范标题与原件。Replay在重新授权后的服务层调用，不联系解析器；未来新上传预检须位于Replay之后、Enqueue事务之前。本组件接收可信会话ID，不负责HTTP鉴权，也未提供新的公开入口。

队列独立于05 Task/outbox。数据库UTC时间、先锁Document再锁job、claim累计attempt/epoch、60秒租约、20秒心跳；调度轮询1秒且每个worker只运行一个解析调用。每笔SQL事务5秒，解析回调在事务外且总预算35秒。完整class/owner/epoch/processing/leased/未过期条件约束续租与发布，最终CAS过期则整个索引/状态事务回滚。到期的第三次尝试关闭为failed/worker_interrupted，不开第四次。显式retry只接受既定三种原因且attempt<3，保留原202、epoch与累计attempt。

发布前重新计算持久原件SHA，并核对claim时摘要、持久摘要和格式；有界Unicode正文、页/逻辑块顺序及覆盖验证后，从正文生成最多2000码点、重叠200的片段，不接收外部quote作为权威。位置/片段、正文、终态和关闭job原子提交，失败无部分ready。

当前默认server没有导入/启动组件；Target5、22 current、13 active键、四默认生产服务和全部旧SQL保持。真实迁移6/dirty/repair/备份恢复、生产配置网络与五镜像、六个Document授权HTTP、实际PDF→持久队列全链路及页面仍未完成；A2.3/A2.4父项不勾。

## 场景与实际验证

原候选SQL探针先验证五DDL/六FK/十一CHECK及16个真实拒绝，再在同一准确候选schema运行Go测试。Go容器仅共享该独占MySQL的network=none网络命名空间，无宿主端口；随机凭据只经临时env/进程环境，原件保留脱敏日志，结束删除自己的容器/tag/凭据。未执行生产迁移管理器。

| 场景 | 真实数据库验证 |
| --- | --- |
| DI-SC-07 | 20同键只建一份/原202逐字相同，20混合载荷10接受10冲突，case/用户/班级作用域独立；处理后新Store仍重放原queued快照 |
| DI-SC-07/09 | 原件/job/快照三个注入边界全部回滚，SQL锁等待被调用方80ms预算中断且无半份数据 |
| DI-SC-08 | 20并发claim只有一个，错误owner/epoch/class和过期租约拒绝，实际子进程claim后被Kill，持久租约过期后新owner接管并发布 |
| DI-SC-09 | 四个结果事务边界失败全回滚，持久原件摘要损坏拒绝，非BMP出处逐字正确，写结果期间租约到期最终CAS拒绝全部索引 |
| DI-SC-10 | 三次总上限、耗尽关闭，七原因重试白名单、20并发retry只有一个、重试中断回滚、needs_ocr不伪ready/不可重试 |
| DI-SC-05/08/14 | Word逻辑块/2000与200重叠边界、单worker最大并发1、实际续租与取消后无迟到发布；typed结果边界单元测试 |

10个MySQL测试组与1个结果边界单元组已在完整 `npm run check` 中真实执行，未skip；原40合同/strict11/11、Go全包、原解析核心40/25与私有HTTP7组/40实际语料、原候选SQL断言均通过。此处队列解析回调使用受控固定结果，真实PDF/Word提取与队列合用仍待生产适配；实际进程Kill发生于claim提交后，其他kill/OOM/容器重建/授权HTTPS不是本批已完成事项。

初轮单元测试拒绝了含竖线的非闭合原因，修复为精确枚举；首次带tag编译发现辅助函数与os/exec同名，已改显式导入别名。失败输出保留，不改断言放行。关键冲突载荷守卫临时失效，真实MySQL测试退出1并命中“same key changed payload”；逐字恢复后退出0，前后源码SHA一致，见controlled-proof.json。

本轮npm ci/setup、完整check、原生npm audit两树、历史220提交与暂存空内容秘密扫描均0。上述check在编写工作树执行（dirty=true）；干净提交的原完整gate/容器verify、实际制品扫描与最终CI仍待执行，不把前述结果写成干净版本全门禁通过。

## 同轮团队跟进

小张亲自审查#50最终6422f29：仅80个文档/证据文件，212个本地链接存在，运行输入逐字继承main97f25b9；下载当前CI43575968453/artifact14106610497，ZIP摘要c5c3ad21793c9c5945e568204fc06e03f1a696dcf976d89426cda3f8b658f5e5与GitHub一致。独立核验四段0、原05/恢复/HTTPS/四镜像与候选、两轮HTTP7组各40实际文件和SQL16实际拒绝/清理，解包秘密扫描0；最终head与CI预演树286cd9b相同，无未解决thread。本人实际APPROVED5904277600后绑定head正常合入main `c1ac4213580df1fcc03520b8dddcfbece2a3344d`。该main精确CI待结果；不是本机重新跑#50 Docker。本轮后续会合并该文档主干，保留双方台账事实。
