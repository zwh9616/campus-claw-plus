# 04E 私有解析 HTTP 组件：小陈实际审查与主干核验

2026-11-14，小陈 / Kevcco（AI辅助）审查[PR #51](https://github.com/zwh9616/campus-claw-plus/pull/51)最终 `97d4f0802b9c0654876a7e755f9931bcb7305583`。依据已获审合入的 #48 I1/I2、DI-SC-14 及统一负责人例外，仅审私有 HTTP 组件入库；全部04E实施仍由小张负责。

## 审查结论与范围

逐行核对 `server.py`、`test_rpc.py`、原 runner/worker、镜像和 check/scan 装配，未发现阻断本组件入库的问题。Bearer恒定时间认证先于读体；重复头/Transfer-Encoding/非法长度或MIME/额外已缓冲正文拒绝；头8KiB、原件10MiB、头体各5秒绝对读取预算、请求35秒、解析并发1/busy、忙碌健康、固定8091、独立受限子进程及临时文件清理符合本批合同。日志仅受控路径/状态/耗时及服务生成标识。解析响应的未来Go客户端严格验证、网络与配置原子激活另验。

本批默认入口仍为离线CLI，生产Compose、13个active空键、22 current操作、Target5及旧SQL不变。此批准不代表五生产服务、迁移6、持久队列/授权上传、真实PDF/Word页面或整个A/B/C验收；六个公开Document操作仍frozen。

## 本人本机实际执行

Node24.22.1 / npm10.5.0 / Go1.27.3 / Python3.12；保留原4个未跟踪文件，工作树因此非干净，未冒称干净运行。本机没有Docker可执行文件。

| 命令/检查 | 实际结果与限制 |
| --- | --- |
| `npm run check` | **退出1**。前置基础、40合同组、批次/身份/前端、类型/构建、Go及strict11/11通过；到解析镜像构建因Docker ENOENT阻断，后置SQL未运行。[完整输出](chen-parser-rpc-review/local-check.txt)、[退出记录](chen-parser-rpc-review/local-check.json)、[原解析失败](chen-parser-rpc-review/local-parser-failure.json)保留。 |
| `python -B reports/changes/04E/chen-parser-rpc-review/probe_http.py` | **退出0，5组/18真实套接字请求**。未认证大正文即时拒绝且不调用子进程、坏帧/受控路径、busy时健康、真实慢头/慢体超时释放锁、响应字节边界/清理。[原件](chen-parser-rpc-review/local-http.json)/[输出](chen-parser-rpc-review/local-http.txt)。最后一组明确使用子进程替身，仅证明HTTP分派，不证明本机PDF解析、Linux沙箱或数据库。 |
| 同探测加 `--mutate-auth` 后恢复原进程 | 仅本人专属进程内将恒定时间比较替换为总通过，关键认证断言**红1→原实现绿0**；跟踪server.py SHA逐字未变。[摘要](chen-parser-rpc-review/local-http-red-green.json)/[红输出](chen-parser-rpc-review/local-http-red.txt)。不冒称Docker变异试验。 |
| `npm run audit` / `npm run secret-scan` | 根与前端0漏洞/退出0；全历史220及暂存秘密扫描0。[audit](chen-parser-rpc-review/local-audit.txt)/[扫描](chen-parser-rpc-review/local-secrets.txt)。 |

作者的真实隔离容器认证变异红1→绿0、原server.py摘要和清理也已独立核对，保持其原件及真实作者范围；没有伪造第二次本机容器复跑。

## 最终 PR CI 原件核验

重新下载首轮CI43572312029原件，其ZIP `81648eed21afb0da0d0fe1522bc76dead99c82e4001782dd5a526272fe8c216b` 与 #51 已提交原ZIP逐字节一致；[本次原运行](chen-parser-rpc-review/initial-runtime-verified.json)/[解析](chen-parser-rpc-review/initial-parser-verified.json)/[HTTP](chen-parser-rpc-review/initial-http-verified.json)/[SQL](chen-parser-rpc-review/initial-sql-verified.json)/[05](chen-parser-rpc-review/initial-assignments-verified.json)核验通过。

最终head[完整CI43574255975](https://github.com/zwh9616/campus-claw-plus/actions/runs/43574255975) completed/success；artifact14105527850，[原ZIP](chen-parser-rpc-review/final-pr-ci.zip) SHA-256 `8fb5ecd7a2de55cf8f3197d22c71d48d7c1be81d8ae27d85e07d975ea603abd4` 等于GitHub digest。CI预演 `86b34a109b428ceb8c4255ea896386fd8fd668f8` 与最终head整树均为 `02073998959f785787b4ec3ab7037cc5eac38307`。

独立读取原件验证四段gate0；check/scan两轮各7组真实HTTP、40份PDF/DOCX→真实受限子进程、195位置及安全日志；server/test_rpc计入八输入SHA指纹。原内核8组/40清晰/25负例/45关键句、四生产镜像及离线候选同不可变制品零HIGH/CRITICAL、18组05/五恢复/三HTTPS持久pending、实际MySQL16约束拒绝和全部清理通过。原因码映射替身与40实际提取分列，不将替身说成真实HTTP OOM/超时复现。

[运行核对](chen-parser-rpc-review/final-pr-verified-facts.json) · [HTTP核对](chen-parser-rpc-review/final-pr-http-verified.json) · [原解析核对](chen-parser-rpc-review/final-pr-parser-verified.json) · [SQL核对](chen-parser-rpc-review/final-pr-storage-verified.json) · [05核对](chen-parser-rpc-review/final-pr-assignment-verified.json)。首轮及最终两份解包原文秘密扫描均0；[首轮](chen-parser-rpc-review/initial-artifact-secrets.txt)/[最终](chen-parser-rpc-review/final-artifact-secrets.txt)。此处为本人下载核验CI原件，未冒称本人本机Docker通过。

## 实际批准与主干

本人[APPROVED5903073379](https://github.com/zwh9616/campus-claw-plus/pull/51#pullrequestreview-5903073379)绑定最终97d4f08，远端保护满足后正常合入main `97f25b9d4624cd811020b564423704239f7a5e0a`，无管理员绕过；获批/main整树一致。精确main[完整CI43575033114](https://github.com/zwh9616/campus-claw-plus/actions/runs/43575033114)已实际completed/success，已下载原件核验，不用PR绿灯替代主干结果。共享表/README和本轮原件同步既有#50，保留 #48/#49 实际收口与 #51 作者全部记录；不为同一变更重复新建PR。

下一步仍由小张按A1.2b完成Go客户端、配置和网络原子激活/五生产镜像验收，再推进A1.3b真实迁移6中断/repair6/隔离恢复5、A2持久队列和授权接口。#50本账号为作者，仍须小张实际批准最终提交；不代小张批准。样板方向确认、真实页面、OCR/语义检索继续按各自前置，不提前勾完成。

## 实际精确主干复验

实际下载artifact14106087660，[main原ZIP](chen-parser-rpc-review/main-ci.zip) SHA-256 `3411e6865e0222029291446e94c4cf74bbadf2679b01626a522ecfa2ce515982` 与GitHub digest一致；CI head及原件干净来源均为97f25b9，获批/main整树02073998959f785787b4ec3ab7037cc5eac38307一致，保护保持。[实际批准/合入元数据](chen-parser-rpc-review/main-acceptance.json)及[实际收口评论](https://github.com/zwh9616/campus-claw-plus/pull/51#issuecomment-6874503459)。

[main运行核对](chen-parser-rpc-review/main-runtime.json)完整四段0/notRun空、四生产镜像零HIGH/CRITICAL/同轮运行ID/四清理；[HTTP核对](chen-parser-rpc-review/main-http.json)check/scan各7组/40真实文件/195位置/安全日志/清理；[原内核](chen-parser-rpc-review/main-parser.json)40清晰/25负例/45关键句与同候选镜像实扫/资源隔离；[05](chen-parser-rpc-review/main-assignments.json)18组真实SQL/worker、五恢复、三HTTPS持久pending；[SQL](chen-parser-rpc-review/main-storage.json)准确候选DDL/16实际拒绝/Unicode/quote回滚/清理及秘密移除全部通过。解包[秘密扫描](chen-parser-rpc-review/main-artifact-secrets.txt)0。这是本次下载独立核验原件，不是本机Docker复跑；父任务A1.2b、迁移6/恢复和整个A仍未勾。

本次#50按两方实际事实处理共享表冲突，保留全部作者与此前#48/#49证据，运行输入相对新main逐字一致；[foundation](chen-parser-rpc-review/closeout-foundation.txt)/[strict11/11](chen-parser-rpc-review/closeout-spec.txt)、链接及diff检查通过，最终新增证据目录和暂存秘密扫描另在本提交实测。#50最终提交自身CI及小张真实批准仍独立核对，未预填。
