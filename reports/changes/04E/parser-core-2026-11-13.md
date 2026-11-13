# 04E A：PDF / DOCX离线解析首组件

执行人小张，2026-11-13，分支`codex/04-document-parsing-2026-11-13`，从精确main25484d542278bd5bf65d2ae02688c0de833e8ccc隔离工作树开始；原根目录分支和修改保留。本提交不是整个A完成或生产接线。

## 前置实际成立（DI-SC-01/25）

合同[#45](https://github.com/zwh9616/campus-claw-plus/pull/45)最终c1594f3已获小陈/Kevcco实际APPROVED5887589698，两条P2线程已解决，完整CI43385390971成功后正常合入main25484d5。获批与main树均3728f24c0734a2b49b4d4091083b53545bb011f8。精确[main CI43386051027](https://github.com/zwh9616/campus-claw-plus/actions/runs/43386051027)成功；artifact14018872037已实际下载，ZIP SHA-256 `18f5a502a7aebc02b82552babccda44071985f672199a9dc482b5c7aabe26743`。

独立解包核对原四段gate=0、verify185948ms、四镜像raw识别/零HIGH CRITICAL/同轮运行ID、真实SQL负例与默认HTTPS/持久重建、四清理均通过，源commit精确main且dirty=false。原件[ZIP](parser-core/contract-main-runtime.zip)及[独立核对JSON](parser-core/contract-main-verified.json)。Windows/Linux换行不同可能导致全tracked字节fingerprint不同，以精确commit/树关联，不冒称跨机器字节指纹相同。

## 本组件和测试映射

| 场景 | 实现与真实测试 | 边界 |
| --- | --- | --- |
| DI-SC-03/05 | pypdf7.0.1逐页文本层，source_page_count、码点半开位置、混合扫描页整份needs_ocr | 200页、解码内容流32MiB、正文UTF-8 2MiB，空白/加密/损坏拒绝 |
| DI-SC-04/05 | 标准库ZIP/XML、正文与表格内多段按XML序，空白段落占逻辑unit，非BMP/组合字符出处 | 不伪造Word页码；普通DOCX以外图形/宏/实体/外链拒绝 |
| DI-SC-02/06 | 固定20 PDF/25页+20 DOCX，源字符串金标准195单位/45关键句；25类负例与输入±1、200页/20000块边界 | 负例由固定recipe产生，真实压缩/展开/页数/正文超限，不提交大炸弹；上传HTTP参数边界另待验 |
| DI-SC-14 | 实际镜像非root/只读/no caps/无出站/512MiB无swap/1CPU/32PIDs/64MiB临时卷；子进程384MiB/30秒、输出8MiB上限、进程组回收 | 真子进程超时、内存失败、SIGTERM、leader先退出的后代管道场景；不等于持久worker claim/restart/DB恢复 |
| DI-SC-06有效断言 | 暂改真实页数上限200→201，固定201页负例必须红，再逐字恢复源码并跑绿 | 测试/语料/阈值不改，无生产测试开关 |

固定清晰语料在实现前生成，PDF全25页Poppler渲染实看、20/20独立提取与源金标准规范化相同，字体来源/OFL/Git blob/SHA齐全；报告不把Poppler当项目解析器。测试使用的开发/负例构造代码不进入生产镜像。清晰正文指标只覆盖普通支持版式，不承诺复杂公式、页眉脚注或视觉阅读顺序重建。

首轮真实候选通过8组/40清晰/25负例，逐文件CER=0、195位置与45关键句100%，最大清晰单份727ms，测试主进程峰RSS101120KiB（不是整个容器内存峰值）。之后补强进程组回收与子进程实际384MiB限制探针，最终检查另记，不能沿用首轮作最终head结论。

## 检查与证据

当前已执行：npm ci/setup0；首轮实际40份质量与25负例0；真实页数受控红1、原文件逐字恢复。最终check/audit/secret-scan/完整gate、候选镜像扫描和CI正在执行，尚未写通过。

首次候选镜像扫描因GHCR漏洞库下载3分钟超时失败（不是零漏洞结论），完整原输出保留[失败JSON](parser-core/initial-scan-db-timeout.json)。正在使用仓库已有`npm run prepare:scan-db`的ECR/GHCR/GCR受审回退准备数据库，不修改退出码、跳过更新或忽略漏洞；成功后重新扫描。锁定的Python基础镜像/pypdf wheel只说明来源，不替代实际镜像漏洞扫描。

后续实际核对：准备命令的ECR下载同样长时间未响应，已只停止本作业容器，真实失败/取消输出保留[原文](parser-core/database-preparation-canceled.txt)。使用今天#45已完成验收留下的相同Trivy数据库，UpdatedAt=2026-11-13T00:58:46Z、NextUpdate=2026-11-14T00:58:46Z，仍有效；只读挂载来源缓存复制公开db/metadata到本工作树缓存，源/目标数据库SHA-256相同，详见[来源原件](parser-core/database-cache-provenance.txt)。重新扫描不关闭数据库更新或漏洞规则。

实际重扫发现初选Python3.14-slim-bookworm含42项OS及5项Python HIGH/CRITICAL（含不需要的pip vendored包），阻断结论/全部raw已保留[失败摘要](parser-core/bookworm-scan-failed.json)和[原始扫描](parser-core/bookworm-vulnerabilities.json)。本次改用官方Python3.14.10-alpine3.24精确索引摘要5862d971…（amd64官方manifest76c65fc8…），实际移除运行时不使用的pip与ensurepip代码/轮子，仅构建阶段下载精确hash的pypdf。保留全部漏洞规则和包识别要求，不隐藏包元数据或添加忽略；新镜像重新检查与扫描另核。

完整check首轮还捕获旧verify入口精确守卫，已保留[失败原输出](parser-core/initial-entry-guard-failure.txt)；恢复原npm verify入口和全部原断言，在原三个真实运行程序及证据校验之后增加候选扫描，未放宽原current批次/镜像覆盖。其后完整check0（strict11/11/34合同/解析8组）及npm audit两树0；镜像更换后的最终检查另记。

## 留待后续的明确工作

私有RPC/配置/失败规则、准确000006冻结/批准，持久原件与幂等202、owner/epoch/lease解析队列、六个HTTP授权/搜索/下载/出处和PDF/Word四态样板/真实HTTPS均未实现；A1.2后半、A1.3、A2.3以后的项及A4整体验收保持待办。旧22 current/Target5/active配置/四生产服务镜像、原01/04/05运行不变。B OCR与C真实嵌入/索引仍按已明确任务/阈值推进，未声称可用；统一小张负责不伪造其他成员批准。

## 提交前最终功能核对（本工作树有改动，如实标dirty=true）

完整`npm run check`退出0，原入口/全部断言保持，strict11/11、34合同组及新解析8组全部通过；最终核心40份逐文件CER=0、195位置/45关键句100%，25类负例无缺项，最大清晰单份934ms。新增独立开发AES-256空密码PDF真实拒绝encrypted，不安装可选crypto；金标准40文件不改。全历史202提交/暂存内容秘密扫描0，audit两树0。原件见[功能JSON](parser-core/functional-results.json)、[逐文件/负例指标](parser-core/functional-tests.json)、[完整check](parser-core/full-check.txt)、[秘密扫描](parser-core/secret-scan.txt)及[受控红绿](parser-core/controlled-red-green.json)。红测试之后只补强AES/不支持过滤器的失败分类，页数上限逐字恢复未变。

Alpine候选已实际扫描OS和pypdf7.0.1，零HIGH/CRITICAL，摘要/导出SHA/raw SHA及清理见[候选摘要](parser-core/alpine-candidate-scan.json)、[Trivy原文](parser-core/alpine-candidate-raw.json)。该扫描早于AES小修，最终版本需原完整gate重测重扫，不能冒称该先前镜像就是最终head。verify新增流程会对同一个不可变候选ID先跑40份/25负例，再导出实扫并绑定原件；不以不同构建的元数据/manifest ID相等作假设。

下一步在干净提交执行原完整gate并创建组件PR，最终head CI与远端真实批准后才正常合并，整个A与B/C仍未验收。本提交共享表对应行同步这些实际结果；不用它自身SHA预填自身证明。

最终提交前另补实测：只把实际绘制的图像/嵌套Form当扫描页，空白页未使用的共享图片资源不误判；AES空密码、ZIP原始NUL名与OPC根节点校验已补强。新完整check再跑退出0，40份CER=0/195位置/45关键句/25负例及新增开发边界均过，最大清晰单份959ms，原件已替换为最后一次实测；页数限制保持200。候选最终镜像扫描及干净提交完整gate仍待下面补证。

## 干净代码提交完整门禁与首轮CI（补证提交）

代码提交36f1d1ed3c46ceab1690f5b1d1e799e1c684dd05工作树干净，原`npm run gate`四段全部0、notRun为空，verify335519ms；原四生产镜像与独立离线候选均零HIGH/CRITICAL，真实HTTPS/数据库停机/全部重建/旧版迁移恢复和同轮绑定、四生产镜像清理及两个候选资源清理均通过。候选单一不可变ID先通过40份/25负例，再导出实际镜像实扫；正文CER=0、195位置/45关键句100%，最长清晰942ms。ZIP SHA-256 `05d1391b20fd5ad75d7e3120f34c5b58714b3cddf44df8c354314740ecd79c7d`，[完整本机原件](parser-core/local-clean-runtime.zip)、[原四镜像独立核对](parser-core/local-clean-verified.json)、[候选及语料核对](parser-core/local-parser-verified.json)。Docker主机实报20CPU/8182206464字节，候选自身固定1CPU/512MiB；这不是A4要求的整个4CPU/8GiB固定部署全链路性能验收。

首轮[CI43393658201](https://github.com/zwh9616/campus-claw-plus/actions/runs/43393658201)完整成功，实际artifact14022236968已下载，ZIP SHA-256 `4360200cc9c0c26f8924b87ba565aeeb083bc9609e6fc3f2c3289ec5300fe6bd`。CI checkout为实际PR合并预演9776bb1ed17f706f5a40114d2ddef0de4005bc2a，head为36f1d1e，两个树已实际获取并核对；原四段0/verify267906ms、四生产镜像+离线候选零HIGH/CRITICAL、40/25完整、195位置/45关键句、清理及真实SQL/HTTPS恢复全部通过，最长清晰1068ms。见[CI原件](parser-core/first-ci-runtime.zip)、[基线核对](parser-core/first-ci-verified.json)、[解析候选核对](parser-core/first-ci-parser-verified.json)。CI/Windows全tracked字节指纹分别如实记录，不混称相同。

终端输出/第三方许可证仅规范化行尾空白以通过diff检查，所有原始字节保留在[原始归档](parser-core/original-terminal-and-license.zip)，OFL法律正文未改；没有添加白名单或放宽断言。首次手工构建留下的本作业旧tag已精确删除，见[清理原文](parser-core/initial-tag-cleanup.txt)，不影响其他服务。

本提交只补上述原件、tasks及共享表：A2.1/A2.2勾离线内核实现，A1.2 RPC/配置、A1.3准确DDL及A2.3后持久/HTTP/UI和A4全链路仍未完成。已实际请求Kevcco审核#46以满足远端保护，不转移小张职责；尚无真实批准，最终补证head的CI与main复验待核，不能据首轮成功直接合并或声称A交付。
