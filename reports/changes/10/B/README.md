# 10-B 第一批：身份、MySQL、资料运行接入

2026-11-12用户明确授权推进10-B。小陈（Kevcco，AI辅助）实现/自测，小葛（gjj6666）逐批终审。本批从main `1fa47ee2c3d486ba4fcfb615ee73ea22de0b05c7`开始，仅核对已批准并集成的01/02/04；不重复实现业务，不把05/06未合入代码或planned服务加入部署。

已交[PR #32](https://github.com/zwh9616/campus-claw-plus/pull/32)，实际请求小葛/gjj6666审查。首实现head7d4373e完整CI43181709752通过，四门禁全0及真实批次摘要0；原始artifact已下载核对，见[CI事实](ci/facts.json)、[完整门禁](ci/gate-results.json)、[批次摘要](ci/batch-results.json)和[原件](ci/evidence.zip)。本提交仅补交接与真实结果，当前head CI另看PR，不将旧head成功代替新head；小葛终审及合入/main复验未做。

## 服务登记与准入

机器索引：[deploy/service-batches.json](../../../../deploy/service-batches.json)。仅登记键名、镜像来源和来源SHA，不包含运行凭据或本机路径。G2/G3沿用[既有共同记录](../A/main-integration-2026-11-07.md)，各业务依据已验收主规约，不能用本批放行后续服务。

| 服务 / 业务来源 | 镜像及网络 | 依赖、探针与故障 |
| --- | --- | --- |
| mysql / 01及04持久库 | 既有固定MySQL8.4.13摘要及Go gosu构建；仅data内部网、命名卷 | mysqladmin ping为进程连通探针（2秒），不代替TLS/权限/迁移就绪；业务与健康真实DB操作另验 |
| admin / 01及04离线迁移初始化 | 既有scratch admin；仅data，tools profile | 非常驻服务、无health；离线命令失败非零，独立DDL账号，不成为在线health依赖 |
| backend / 01身份及04资料 | 固定Go构建→scratch；data/proxy、不发布端口 | 真实MySQL为必需依赖；`/server --healthcheck`、Go请求及Compose/Docker最大3秒，无空依赖回退 |
| frontend / 已验收02身份页面 | 固定Node构建、固定Nginx摘要和现有libxslt补丁；ingress/proxy，仅主机环回HTTPS | nginx -t只校验配置；另从真实主机发布端口验证CA/SAN、健康与API。DB停机静态首页仍200，身份/资料依其合同失败 |

完整配置键/消费者取config-register.active，索引逐服务覆盖全部13键。backend不读取MYSQL_MIGRATION_DSN；admin只离线读取；证书/私钥只读挂载，秘密不在ARG/镜像层/前端/日志/仓库。网络、profile和构建目标与唯一根Compose匹配，新增服务/未登记键/未固定镜像/超过3秒探针均阻断check。

材料检索是04已验收Go/MySQL模块，无独立检索容器或向量库。03 MCP、05任务、07模型、08成绩待各自准入；06 PR #30资料页面尚未合入，不在本批。可选LLM尚未运行，不能用一个假容器制造“可选依赖停机通过”。

## 本次改动与执行入口

1. 补齐四服务/批准change/集成SHA/配置/依赖/探针登记和check检查，纳入原`npm run check`，不删除原子项。
2. 修复原Go3.5秒、Docker/Compose4秒探针与00及10 D4的3秒约定不一致，收紧到3秒；保留健康JSON及服务端DB Ping预算。新增真实慢响应头/慢响应体测试，旧3.5秒实现会误放行。
3. `npm run verify`通过薄包装顺序调用**原有三程序**：镜像扫描→默认Compose/HTTPS→真实MySQL身份/资料与恢复；任何失败/取消/超时非零并停止。没有第二套部署入口。
4. 新增运行摘要，只接受本轮时间范围内的四份原始报告，核对源Dockerfile摘要、扫描/实际运行镜像ID和0高危/严重；旧报告/缺件/错误/镜像不符不能通过，产物留`output/service-batches/results.json`并在原CI artifact保留。
5. 默认Compose真停DB后，从实际主机HTTPS验证health503及静态首页200、容器真实探针非零；检查全部前端产物、运行镜像配置/history与应用日志不包含本轮生成凭据。临时凭据仍只在隔离运行目录、finally清理，不把正文/资产字节放报告。

## DO场景与状态

| 任务 / 场景 | 检查和证据入口 | 当前状态 |
| --- | --- | --- |
| 4.1 / DO-SC-11、13 | service-batches索引 + check；全部服务来源/网络/配置/探针一致 | 本批已登记并可检查；不代表后续批次完成 |
| 4.2 / DO-SC-11、12 | 原verify三程序；默认Compose缺配置、healthy、真实主机HTTPS、DB停启/静态可用、保留卷重建、身份/资料真实回归 | 7d4373e完整CI43181709752通过，verify167125ms；本机Docker失败保留，新head CI另核 |
| 4.3 / DO-SC-13 | 原全历史/暂存扫描、四镜像实扫、生成秘密排除、权限/TLS与MCP默认禁用回归 | 同轮四镜像0高危/严重、实际镜像与扫描一致、秘密排除通过；不冒充小葛独立复跑 |
| 4.4 / 本批终审 | 小葛核对最终head及运行原件并亲自复跑关键项，直接修复后收口 | 待小葛；不代批准/合并 |

结构性Node测试用合成报告验证失败边界，与真实Docker执行分列；原历史成功只作来源，不能作为本批新SHA通过。检查记录见[本次自测](self-check-2026-11-12.md)。

本批逐项通过并经小葛终审后可记第一批完成；10-B的全量4.1..4.4仍须等待其余受审服务逐批接齐，10-C和10整体归档继续待办。
