# 04E A1后半：内部接线与候选迁移冻结

小张，2026-11-13，隔离分支`codex/04-parser-integration-contracts-2026-11-13`，基线main9263d21de054909856a9b4b3b7d17d54c90addb9；原根目录、已关闭来源分支和其他成员修改保留。本轮接线候选获审合入前不apply运行服务或持久存储。

## 团队实际进展

已通过远端API和最新main核对：#44最终497a373经小葛实际审查后已合入47bcc6a，10-B第二批05运行覆盖完成；#47最终c1b9cb7已正常合入9263d21，包含#44与#46收口双方原件。最新精确main完整CI43410165907实际completed/success，开工时打开PR为0。本次这里只声明API/主干状态核对，未冒称重新执行另一成员机器验收。10-B全量/C、生产批改执行器、作业页面、OCR和语义仍未交付。

## 本批变更与边界

- 私有协议两操作/三个单源Schema独立于公开OpenAPI，独立2020-12与解引用双路径/HTTP状态-结果/码点语义反例；合同引用只允许显式本地名单，HTTP和任意文件解析关闭。
- 只冻结DOCUMENT_PARSER_URL/TOKEN两个键及原提交快照优先于新上传预检、500ms/35s预算与完整owner/epoch/processing/租约CAS；不进active/空样例、不装配服务。
- 五表准确DDL仅在docs合同目录，绑定SHA/次序、复合FK/原键/状态/CHECK、五步中断和隔离恢复5方案；不进backend embed/manifest、不改旧SQL/Target5。
- 原39组（34原+5新增）合同行为均通过，保留原校验并把原“frozen必须空”精确扩为仅这两个04E候选；原active、身份健康、迁移清单和新反例继续严格拒绝错误。没有泛化放行任意frozen配置。
- 独占MySQL8.4.13候选DDL实测通过：先仅执行五份已发布建表SQL得到14表，候选增加5表/6 FK/11个ENFORCED CHECK；验证非BMP码点/字节、跨班/版本/创建人FK、二进制键、状态和错误码拒绝；清空本作业数据后逆序移除候选表恢复14表，并清理自身容器/tag/临时秘密。不是正式Target5→6 admin迁移、dirty/repair/真实202/备份/重启恢复。

同长度错误quote可通过SQL长度CHECK的实际事务已回滚，保留原quote；明确未来应用必须逐字读持久源和完整租约CAS后发布，不用SQL探针冒充业务原子性。后续真实20并发、kill/restart、五DDL中断、旧制品拒绝6/隔离恢复5及真实HTTPS/页面/五生产镜像验收均未执行。

## 真实检查与原件

npm ci/setup0；候选合同39组/原公共双路径和新私有双路径/反例0；SQL候选探针0及清理通过。首次冻结键被旧身份空数组守卫阻断，已精确扩展且保留旧反例；Windows引用盘符大小写失败已修为按本机文件系统规范化，仍关闭所有默认file/http解析器；首次SQL探针误用旧Dockerfile路径失败，已改为仓库实际锁定镜像目录。三个原始失败保留，不把失败重写成成功。

实际SQL非NULL约束受控破坏、逐字恢复与原完整check/audit/secret/gate正在执行；本批尚未获实际批准、未合并，不预填最终head/CI/main结果。新check仅追加SQL合同探针，原check/verify/12批次/18组05/五恢复/三HTTPS及四生产镜像+离线候选均保留。源码/命令/退出码及原件随后补入本目录，共享表04E及关联06行同提交同步；所有实施职责仍小张。

## 提交前补证（本工作树dirty=true）

实际非NULL约束受控破坏：只移除ready PDF页数显式IS NOT NULL并同步候选hash，MySQL CHECK的UNKNOWN确实放过非法ready，既有真实反例因此退出1；SQL与合同文件已逐字恢复。随后严格原完整check0（39组合同行为、12批次、Go/类型/构建/strict11/11、真实40份解析和SQL候选探针），audit两树0。补强测量字段与私有JSON/参数规则后的合同39组及SQL探针再次0；最终干净提交gate另核。

SQL探针现保存实际MySQL版本与实际错误码：16个确定性拒绝逐项与3819/1452/1062匹配，Unicode实际CHAR_LENGTH=8/OCTET_LENGTH=21，临时秘密文件和自身容器/tag均清理。完整check曾抓到官方MySQL临时初始化daemon的socket SELECT误就绪，原失败JSON/日志保留；现探针强制自身127.0.0.1 TCP，仅最终网络监听通过才继续，不使用等待固定秒数假成功。

原件位于[integration-contract目录](integration-contract/controlled-red-green.json)：full-check/contract-check/npm-audit、ddl-probe-results/output、受控红/恢复、四类原始失败。首次red早于TCP/测量及严格JSON补强，未改回已恢复的SQL字节；新全绿覆盖后续改动。现有有效Trivy公开数据库仅从今天已验收缓存只读复制，源/目标SHA一致，原件metadata/NextUpdate记录，不使用skip-update或漏洞忽略。

这仍不代表真实迁移6、dirty/repair6/5备份隔离恢复或持久RPC/HTTP/UI验收。全部职责小张，候选实际批准/正常合入前不apply；当前39组合同行为是静态/合成协议检查，SQL探针只证明隔离表结构约束。

提交前最终核对：39组合同行为及私有双路径、原完整check/12批次/strict11/11、audit两树均0；后续补强严格JSON/未授权参数和实际错误码记录的定向检查再过。257本地链接无缺失，候选SQL暂存blob与登记SHA一致，七个受保护运行文件逐字等于已合入基线，十份已发布SQL摘要重算全匹配。

秘密扫描最初命中两条已发布auth_audit SQL的公开SHA-256，已独立重算确认；只将候选中的文件名/摘要改为分字段记录，十条值全部保留，不加ignore/豁免/删规则。初始失败及十文件交叉核对原件保留，随后全历史209提交/暂存扫描0。终端尾空白仅在可读副本规范化，原始字节ZIP完整保留。此为未提交工作树证据；最终代码提交的干净完整gate/CI及实际批准另核。

## 首提交干净门禁及CI；预检清理补强

首提交983796926a828ca48f12f3f1d70e30045d116aab本机工作树干净，原完整gate四段0（verify333550ms）；[本机原运行/解析证据](integration-contract/first-local-runtime.zip)、[四镜像与恢复核对](integration-contract/first-local-verified.json)、[解析候选核对](integration-contract/first-local-parser-verified.json)，ZIP SHA-256 `7ef3612cdcf4b8488a1ef808617497325e2497cd091be2961f79dea407c54a0a`。本机ZIP只收原运行/解析15文件；首轮SQL原件使用下述完整CI16文件，后续本机定向探针另存，不将不同运行SQL摘要拼装成同轮。

首轮CI43419543529实际completed/success，artifact14034220547已实际下载，ZIP SHA-256 `c20744245a9b2cdbdae44af8c222c2a742d246b0175837563bd008c3c5ba0fa1` 与GitHub digest一致。合并预演ed6b1e8与原head9837969树一致（实际fetch核对）。[原件](integration-contract/first-ci-runtime.zip)、[基线核对](integration-contract/first-ci-verified.json)、[解析核对](integration-contract/first-ci-parser-verified.json)、[SQL候选/当前12批次独立核对](integration-contract/first-ci-integration-verified.json)。四段0/verify220526ms、18个05组/五恢复/三HTTPS及精确四镜像/解析候选零HIGH和CRITICAL/清理、40解析/25负例/195位置/45关键句、候选SQL五表/六FK/十一CHECK/16个实际错误码拒绝和清理全部通过。

自检另发现测试工具预检失败时会先写临时凭据再抛出。已用真实CLI+最小候选fixture在隔离目录、对子进程禁用Docker/git的回归中复现遗留1文件，测试finally已清理，未读取或公开凭据值；[红输出](integration-contract/preflight-cleanup-red.txt)。修为所有预检通过后才在受finally保护范围内创建文件，并实际读取/核对当前Go Target5，不硬填运行目标。新增独立回归[绿输出](integration-contract/preflight-cleanup-green.txt)/[源码指纹与红绿](integration-contract/preflight-cleanup-red-green.json)，临时测试目录零遗留，40组合同行为与真实SQL正负例再跑0。该补强只改测试工具/测试/报告，不改候选协议、SQL或运行服务。

#48因该补强临时转草稿阻止旧head直接合并，修复完成后再交实际审查。最终head新的干净完整gate/CI、远端真实批准及main复验另核，不用首轮成功冒充新head通过。所有04E实施仍小张，原首次失败/受控红完整保留，A全链路及B/C未完成。

## 修复代码最终门禁与交接

修复代码 `ed1c18f453b6b8832803d29a5bcfc085b2fcec21` 工作树干净，原完整gate四段0、notRun为空（check124624ms/audit9534ms/secret-scan8237ms/verify371299ms）。[本机完整16文件原件](integration-contract/final-local-runtime.zip) SHA-256 `d22f19d8f65f2af552a86dfae400eb82688df646c6367423e4ca87aaf16d065e`，[运行核对](integration-contract/final-local-verified.json)、[解析核对](integration-contract/final-local-parser-verified.json)、[SQL及当前批次核对](integration-contract/final-local-integration-verified.json)。在任何后续定向探针前封存，SQL/解析/运行报告均属于此轮，不混拼旧报告。

最终代码[CI43422233713](https://github.com/zwh9616/campus-claw-plus/actions/runs/43422233713)实际completed/success，artifact14033704010已实际下载；[CI完整16文件原件](integration-contract/final-ci-runtime.zip) SHA-256 `831790e98dab50398c102e61a0d3d9833637213770777afb3eb18aaeebd7e03a` 与GitHub digest相等。[运行核对](integration-contract/final-ci-verified.json)、[解析核对](integration-contract/final-ci-parser-verified.json)、[SQL及当前批次核对](integration-contract/final-ci-integration-verified.json)、[Git树/原件绑定](integration-contract/final-evidence-binding.json)。预演058e272与代码head树均为7ee298ee745b71f198a54accbd21054c1d81c296；两平台逐文件原始字节指纹各保留自身值，不把换行不同的全跟踪指纹说成跨机器相同。

两轮均四段0，CI verify212401ms；40合同组、40清晰文档/195位置/45关键句CER0及25负例、四生产镜像+离线候选零HIGH/CRITICAL、真实SQL五表/六FK/十一CHECK/16实际错误码拒绝/8码点21字节、18组05/五恢复/三HTTPS/12批次及全部自身清理均独立核验通过。失败与红绿原件保留，不新增豁免。

本次只补已执行结果和共享表/tasks，不改变代码/合同/SQL/运行输入。[PR #48](https://github.com/zwh9616/campus-claw-plus/pull/48)已恢复ready并请求小陈/Kevcco审查；截至本次API核对无review，未批准未合并。此补证提交自身CI另核，真实审核与main复验不预填；候选获审合入前不接线。下一步小张实施私有解析服务与准确迁移6/恢复探针，再推进持久队列、六个HTTP与页面；OCR/语义明确任务仍待后续，不提前算交付。

本次纯补证另测foundation0、strict11/11、99本地链接无缺失、diff检查0，本机/CI两份解包原件秘密扫描均0；源码/脚本/合同/SQL/配置/镜像与已测ed1c18f逐字不变。不为纯记录变更重做本机容器运行，最终补证head仍由自身完整CI验证。
