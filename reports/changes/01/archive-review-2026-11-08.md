# 01身份基础归档核对（2026-11-08）

小陈/Kevcco（AI辅助）在保留本机原有未提交文件后，核对已合入main及01/02真实证据。#19 a6c1ce1已获小葛/gjj6666真实批准5816978046，同head完整CI42456655716成功；绑定预期head正常合入main **ec1095ea0ad613ed74e5875c7fb7e22e2f20cf1c**，整棵树与批准head相同，无绕过。该main是本次归档基线；GitHub事实原件见[快照](archive-2026-11-08/github-facts.json)。

合入后的同SHA main完整CI[42457829034](https://github.com/zwh9616/campus-claw-plus/actions/runs/42457829034)已实际回读completed/success；归档候选仍需自己的完整CI与真实批准。

## 必验项与实际执行者

| 需求/场景 | 已完成的实际验收 | 可追溯证据 |
| --- | --- | --- |
| IDF-01、IDF-SC-01..03/19 | 小张实现请求边界及滑动窗口；小陈核对登录、拒绝与敏感值；既有完整check/真实MySQL套件通过 | [最终独立复核](chen-final-review-2026-11-07.md)、[身份原件](chen-final-identity-2026-11-07.json) |
| IDF-02/03、IDF-SC-04..13/20 | 小陈独立生产HTTPS复跑学生403及刷新/切班/退出旧凭证401；自编真实MySQL服务层用例核对六表副作用、跨班/同班本人范围和受控破坏红绿；小张最终真实浏览器检验跨标签及迟到响应 | [独立复核](chen-final-review-2026-11-07.md)、[首次审修](chen-review-2026-11-07.md)、[02最终联验](../02/zhang-final-2026-11-08.md) |
| IDF-04、IDF-SC-14..16 | 六处DDL中断与前向恢复、初始化并发/幂等/关联失败回滚、重复初始化不改口令、停库恢复与完整重建后原账号/班级/口令保留 | [默认接线原件](chen-final-wiring-2026-11-07.json)、[真实迁移原件](chen-final-identity-2026-11-07.json) |
| IDF-05、IDF-SC-17/18 | 必需输入失败非零、严格CA/SAN和唯一MySQL健康、停库503/恢复、日志脱敏及四实际镜像0 HIGH/CRITICAL；原扫描/工具/网络失败保留 | [小陈独立门禁](chen-final-gate-2026-11-07.json)、[入口修复](host-ingress-review-2026-11-08.md)、[小张Windows复审](zhang-host-review-2026-11-08.md) |
| tasks 3.6b/4.2：最终02交接与同版本集成 | #18 a9d8967获小张批准5816839413，正常合入0596505且main CI42453041413成功；#15 90976b9获小张批准5816948613，正常合入3ef79f4且main CI42456168251成功；3ef79f4整树等于已审head。小张正常信任Firefox默认入口双班五人12项真实联验通过，mock/原生缩放分别留证 | [02实际合入记录](../02/main-integration-2026-11-08.md)、[真实浏览器原件](../02/zhang-final-2026-11-08/real-browser.json)、[G3共同记录](../10/A/main-integration-2026-11-07.md) |

01最后未勾的3.6b和4.2已由上述后续真实结果满足。本次是小陈核对已有各执行者证据，不声称小陈重新运行小张的Windows/浏览器测试，不伪造新会话或批准。01无需等待02归档才核对自身真实集成；02归档4.4仍由小张按其任务完成。

## 归档操作和范围

执行锁定OpenSpec1.13.0的`archive 2026-11-04-identity-foundation --yes --json`，退出0；更新5项Requirement，无删除/放宽。工具保留原日期前缀，归档目录为[2026-11-04-identity-foundation](../../../openspec/changes/archive/2026-11-04-identity-foundation/)，实际归档核对日期为2026-11-08。[现行身份主规约](../../../openspec/specs/identity-foundation/spec.md)保留全部IDF-01..05及20项场景；设计和runtime-plan随档案保留。只补当前主规约的用途/入口，需求与场景原文保持一致。

配置登记与identity-phase仅将`introduced_by`/`activation_change`移到实际档案路径，键名、active状态、必需性、超时、健康及接口均未变；原有校验仍要求路径真实存在。移目录后修正档案内和当前文档的相对链接；历史原始JSON/日志及第7课规约/归档不倒改。共享表顶部、当前里程碑、01行和README旧“静态首页/等待联验”状态同步为实际结果。

4.3的勾选表示本分支已执行归档并同步主规约；本PR尚未真实批准和正常合入时，main仍不能记成已归档。本分支不修改运行源码、SQL、Compose、镜像、锁文件或门禁脚本。

## 本机运行条件交接

按[当前README](../../../README.md)及[默认部署步骤](../../../deploy/identity/README.md)核对：持有人本机提供数据库CA/SAN含mysql的证书和私钥、HTTPS证书及私钥、独立DML/DDL账号、首次卷initialize.sql、backend.env/admin.env和STDIN初始化seed.json。根.env只承载约定的主机/端口/路径输入；backend不读取迁移凭据，可信代理为独占内部网的精确/32，仅frontend接入口网并发布环回HTTPS。

顺序保持构建 → MySQL就绪 → 离线migrate/check → STDIN initialize → backend/frontend就绪 → 正常证书信任的真实登录。重复初始化不改口令；正常down保留命名卷，迁移异常按既有前向恢复，不删库。真实值由持有人在忽略的本机目录准备，本次不读取、不复制、不生成长期账号或证书，不把测试随机账号交作部署默认值。缺件只交接键名/文件名，不传播秘密。

## 本次验证与剩余事项

本次本机检查结果见[命令原件](archive-2026-11-08/validation.json)。完整CI绑定归档PR实际head另核；不以文档检查代替新的Docker运行。已合入运行版本的完整CI、独立Docker和真实浏览器按上表各自版本记录，不冒称本次重跑。

实际工具Node24.22.1/npm10.5.0、Go1.27.3 windows/amd64；npm ci、setup、完整check、audit、归档一致性检查、diff检查及全历史/暂存秘密扫描均退出0。check保留Go vet/test/build、认证/样板检查、合同及OpenSpec全量strict 7/7；5项需求/20场景逐字校验不变，132个本地链接存在，配置登记只发生路径迁移，运行/测试/镜像/Compose/锁文件及第7课历史逐字节不变。本次不新增镜像或运行配置，不重跑独立Docker；其原始实证和最新main完整CI已分别核对。

小张下一步审01归档范围、路径、任务勾选及本次head检查；满足远端真实批准与门禁后正常合入，并由实际合入记录确认main归档。02归档、00无历史会话独立阅读、10 B/C、长期运行部署、版本回滚及标签/上线均未在本次执行。后续教学业务保持暂停，不扩展新规约或开假业务入口。
