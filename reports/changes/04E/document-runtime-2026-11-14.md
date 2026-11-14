# 04E 私有生产解析服务与持久worker接线 2026-11-14

负责人/实际执行：小张/zwh9616。代码8d3d8210822ec981605e5a65bba92a78d5b90041已通过干净本机完整gate和完整CI，当前[#55](https://github.com/zwh9616/campus-claw-plus/pull/55)待真实批准；依赖#52客户端、#53队列、#54迁移6的实际批准与正常集成，尚未合入main或升级持有人库。六个公开Document操作仍frozen/实际404，公开22操作保持。此报告不把可信夹具入队当作授权上传/搜索/下载或真实页面交付，A/B/C父项不勾。

## 实现及Requirement/Scenario

- DI-SC-01/14：默认cmd/server装配runtimeapp，验证精确Target6/TLS后共享DML池，独立单worker/35秒事务外RPC/60秒数据库UTC租约与20秒心跳；SIGTERM取消不发布半结果，SQL故障后监督恢复。backend无parser启动依赖，旧身份/TXT/ready/05不依赖解析器健康；05批改执行器仍未绑定，真实pending。
- DI-SC-14：原子激活两个既审配置键（15active/样例全空）、精确origin与backend/parser专属internal网络；TOKEN为canonical32字节base64url，缺失/非法启动非零无回显。parser仅取得TOKEN，无宿主端口、数据库或模型秘密、外网/额外挂载；nonroot65532/read-only/cap-drop/no-new-privileges/512MiB无swap/1CPU/32PIDs/64MiB tmpfs。固定环回认证probe500ms，公开MySQL健康仍3秒。MCP例外保持disabled。
- DI-SC-03..07/10/14：实际默认Go制品→真实Python子进程→MySQL，40份固定PDF/DOCX的195位置和196片段入库；gold正文/页块kind与unit一致，quote逐字匹配持久正文Unicode码点，片段完整覆盖/2000上限/200重叠，原件SHA与原202快照保持。真实停parser，旧HTTPS/TXT/pending保持且backend独立重建；worker_interrupted后显式retry、停worker入队后重建、实际SIGKILL处理中进程保留租约/新epoch2接管；另实际MySQL停机恢复后成功处理新文件，防止监督器永久停工。租约到期仅隔离测试库显式推进，不冒称等满生产60秒。
- DI-SC-15：继承#54四组真实迁移6/五DDL中断/严格结构/空down和八阶段实际5制品停写备份→中断6→隔离恢复5/旧会话、五账号、TXT、原pending/202→保留源6前向修复。旧十SQL字节不改，无生产force/down/自动DDL。原18组05、五恢复、三HTTPS、身份/TXT、10组真实队列、16 SQL拒绝均保留。

## 实际结果与原件

2026-11-14私有生产接线#55代码8d3d821已完成干净本机原完整gate四段0/verify572497ms及完整CI43610413611四段0/verify397334ms；下载artifact14120805655原18文件ZIP SHA-256 57a73a7ebc97736197922ee0945d04363280f71ecfc86b3f0b896a03421a23e9与GitHub一致。独立核验五精确镜像零HIGH/CRITICAL、40文件/195位置/196片段/原202、九阶段含真实parser故障/实际SIGKILL和MySQL恢复后新文件处理、四组迁移6/五DDL中断/隔离恢复5、原18组05/五恢复/三HTTPS、10组队列/16 SQL拒绝、两轮实际Go/Python/原内核/探针、同轮ID/全部清理及解包秘密扫描；Windows与CI全跟踪输入指纹同80f9c0ba71f8884405d7c6898f5576093b643d206be73e7e87d47aa173b439a3，head与CI预演36e3d947整树均21d96813c373d9e02b72d0cddee06dd3ea2df02c。本提交仅补报告/原件/对应共享行，运行输入保持，最终head检查绑定PR。#52/#53/#54及#55仍待其他账号实际批准，未合入main/未部署持有人库；六新Document HTTP与真实页面、OCR/语义及A父项仍待。

| 原件 | 本机 | GitHub CI |
| --- | --- | --- |
| 完整gate/18文件 | [原ZIP](document-runtime/runtime-recovery-local-gate.zip)，四段0、verify572497ms | [原ZIP](document-runtime/runtime-recovery-ci.zip)，run43610413611/artifact14120805655、四段0、verify397334ms |
| 独立核验/各文件SHA | [本机摘要](document-runtime/runtime-recovery-local-proof.json) | [CI摘要](document-runtime/runtime-recovery-ci-proof.json) |
| 五准确生产制品 | MySQL/backend/admin/frontend/document-parser，同ID实扫运行，HIGH/CRITICAL均0 | 五制品同ID运行及原始扫描全部核验，pypdf7.0.1/Alpine覆盖必需 |
| 解析与边界 | 核心40清晰/25负例、CER0；私有HTTP7组/40实际文件；健康3组；Go真实互通40文件/195位置/实际失联 | check/scan两轮同规模实际执行，秘密/日志/凭据/容器/网络/镜像清理均0 |
| 持久恢复 | 九实际阶段/40文件/195位置/196片段，数据库恢复后新文件ready/原202保持 | 九阶段、全部原回归及迁移恢复原始输出独立核验 |

#54最终c242a51完整CI43607095712、artifact14119141710的[原16文件ZIP](document-runtime/migration6-final-ci.zip)另保存，SHA-256 d83a09ea16e92184b96e1d289717687dc7976f94b3182ac8e3c01e54d7c3e7f6与GitHub一致；真实迁移/原回归/四镜像/清理及整树593d9a92核验通过，CI恢复上界1390ms，仅为隔离演练。并非持有人生产RTO承诺。

## 失败、受控反例与验证边界

固定origin校验受控移除，真实Go测试退出1；逐字恢复后退出0，[原件](document-runtime/config-controlled.json)。初轮测试夹具未先创建depends_on对象及旧四服务清单断言已原子修正精确五服务；未删原用例。第一轮真实wiring将关闭路由的普通404误按JSON解析，[失败原件](document-runtime/first-wiring-failure.json)保留；第二轮九阶段中的原八阶段已通过，但先重建容器导致旧request-id日志不在当前容器，原日志关联断言失败，[原件](document-runtime/second-wiring-failure.json)保留。修复为在重建之前执行原日志断言；随后874a428本机完整gate和CI43609050688均四段0，[本机原件](document-runtime/runtime-first-local-gate.zip)、[CI原件](document-runtime/runtime-code-ci.zip)、[CI摘要](document-runtime/runtime-code-ci-proof.json)保留，未覆盖为本轮结果。

本提交只补证/报告/共享表与tasks，运行输入相对8d3d821保持；最终补证head检查仍绑定其自身PR结果。最终其他账号实际批准、各依赖正常合入与精确main复验均尚未完成。六个公开Document HTTP/真实PDF和Word页面、处理中的SIGTERM/OOM等A剩余验收、用户样板方向确认、OCR与语义阶段及持有人部署另验，不能以本报告勾父任务或宣称用户已能在页面上传PDF/Word。
