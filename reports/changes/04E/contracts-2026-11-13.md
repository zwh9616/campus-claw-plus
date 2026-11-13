# 04E下一阶段正式安排与A机器合同（2026-11-13，小张）

基线main 7f0f32f60e9edf805f4ae548896e330ec8d6e5c3。组长本轮明确PDF/Word优先，OCR和语义检索有任务与验收，全部小张负责；已在[协作规范](../../../docs/standards/collaboration.md)登记仅04E的角色安排，不转派实施，也不虚构独立成员批准。原#43实际批准5886559717绑定dc18ea0、正常合入7f0f32f及精确main CI43371464541已核对，旧待审文字只保留为当时快照。

## 本提交形成的可审查结果

- [完整change](../../../openspec/changes/2026-11-13-materials-document-intelligence/proposal.md)：8项DI需求、25个场景、D0—D9，A PDF/.docx、B OCR、C语义/混合检索分阶段任务，全部小张负责。
- [量化验收表](../../../openspec/changes/2026-11-13-materials-document-intelligence/acceptance.md)：A 20 PDF+20 DOCX、核心正文逐份CER<=0.5%/关键句与出处100%/至少20类负例；B 50页中英旋转盲测、分组CER及bbox/低质核对；C 100份/1000片段/100条盲测，Recall@5/MRR@10/换表达增益/无答案/200越权与真实时延费用。所有数字为验收目标，未宣称已达到。
- 六个frozen操作：Document上传、列表、详情、原件下载、显式重试、关键词搜索；七个闭合单源Schema及双路径正反例。原22 current、所有旧操作和Schema的值、Target5/active配置/运行代码/镜像/SQL/旧归档均未变。配置只登记planned职责，候选000006无SQL/摘要/激活。
- DI-SC-01/02/05/06/07/10/11/12/14/25合同与语义反例纳入原check:contracts；严格限制frozen/current、班级/角色/出处、10MiB上传/展开/内存/时限声明、原202重放/三次重试、故障不得200空。DocumentDetail状态与body/位置关系、quote/版本/Unicode区间为语义检查，JSON Schema单独通过不代替这些约束。

## 实际验证及失败保留

本机Windows、Node v25.2.1，npm ci/setup、原完整npm run check与npm run audit全部退出0；严格规约11/11，原合同26组+新7组=33组全过，无skip；根/前端0漏洞。226个变动Markdown本地链接有效；[一致性明细](contracts/consistency.json)实际比对原22操作、全部旧Schema、active配置与运行输入/旧归档未变。上传上限从10485760临时改成10485761，原合同检查真实退出1；finally逐字节恢复原OpenAPI后完整合同检查0，[红绿原件](contracts/controlled-red-green.json)。

初次Schema编译因条件数值类型未显式声明失败，补integer；DocumentDetail跨字段关系由语义检查保持。第二次因候选时间样例缺毫秒失败，改为复用既有Timestamp精确格式；失败日志均保留，没有关strict或放宽原Timestamp/其他旧断言。[命令原件ZIP](contracts/local-contract-checks.zip)保存安装、失败、红绿、最终check/audit及一致性输出。全历史199提交及暂存秘密扫描0，原件ZIP解包扫描0，无新增豁免；[秘密扫描原件](contracts/secrets.txt)和[解包扫描](contracts/raw-secrets.txt)。本分支完整gate/CI按后续实际结果补记，不能沿用旧main的绿色当本提交通过。

## 尚未完成与下一步

未实现PDF/DOCX解析、隔离服务、迁移6或真实资料页面；B OCR、C真实embedding/索引尚未接线。合成字节包络/JSON例子不能证明真实解析或模型效果。A1.1的冻结语料、A1.2依赖/镜像/RPC/配置和A1.3精确迁移是紧接的实施前任务。

本次已提交[首批PR #45](https://github.com/zwh9616/campus-claw-plus/pull/45)，分支codex/04-document-intelligence-2026-11-13。新公共合同须实际获审正常合入及集成复验后才apply；GitHub至少一位有写权限账号批准的强制保护保留，需要批准时不把小张实施责任转派。当前current运行仍是既有资料TXT/keyword及05真实pending，无新增AI批改或成绩。每个后续提交同提交更新共享表04E及相关06交接。

## 首批代码与本机完整门禁实际结果

干净e02cbd6a7b7db25b2bff85037f22497412862503上原npm run gate全部0，check/audit/secret-scan/verify分别37506/8717/7983/369157ms，notRun空；[本机完整原件ZIP](contracts/local-clean-runtime.zip) SHA-256 a95da0685409ecf1f1dd5ff7d56cb9825945ceee83e582060445654585026cb6，[本机逐项核验](contracts/local-clean-verified.json)。四份源报告摘要、四份真实Trivy原文零HIGH/CRITICAL、同轮扫描/实际运行ID及四清理0，真实MySQL无跳过、三阶段HTTPS/身份/资料/作业原202与恢复通过。

代码[CI43382720058](https://github.com/zwh9616/campus-claw-plus/actions/runs/43382720058)实际completed/success，head e02cbd6，测试合并677531388e5219f5e1ebd2c5a73f78c9abf005ee；实际下载artifact14017960101，[原始ZIP](contracts/initial-ci-runtime.zip) SHA-256 ea5f61b5a72be1ac53018e290eea00b7c05d8934addd71eb04fad617b0fe4d06与GitHub相同。[独立核验](contracts/initial-ci-verified.json)确认四段0/notRun空、verify179306ms，四源摘要/四镜像原始扫描/运行ID/清理及真实MySQL/HTTPS持久恢复均通过，解包秘密扫描0。source.fingerprint是每轮工作树全部跟踪文件的实际字节指纹；本机与Linux CI可能因换行不同而不同，分别记录，不误称仅运行输入指纹或伪造跨机器相同。

A1.2前置研究已实际核对pypdf官方wheel、校验值、许可及OSV公开库查询，原始[元数据](dependency-research/pypdf-candidate.json)/[许可](dependency-research/pypdf-LICENSE.txt)/[OSV](dependency-research/pypdf-osv-raw.json)保存；未安装、未运行解析、未进入镜像，也不把“无公开记录”写成生产镜像无漏洞。Python镜像/RPC/配置与资源实测仍待完成。

本补证同时明确混合扫描PDF不部分假ready、DOCX逻辑块上限和只在A/B/C全部完成后整体归档。补证包含规约/进度/证据及新合同Unicode White_Space语义反例，已复跑完整check退出0、strict11/11、33组通过；不改变frozen/current边界或运行代码；最终补证head完整CI及远端实际批准、正常合入/main复验仍需分别核对。

首次PR的CI测试合并树与head均d918e8a2e1800dab0732acd84efdf441f6333f67，已独立git核对。最终补证明确CER/Recall/MRR分母、原页bbox坐标与每题1..5个相关chunk，避免验收口径歧义。新上传例子使用Unicode White_Space Trim而不是会额外剥离BOM的JS trim，新增BOM+200码点边界反例，原合同与Timestamp不放宽。[本次完整check原件](contracts/final-check.txt)。
