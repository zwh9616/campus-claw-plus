# 04 后端实现候选与验证

小陈，2026-11-11；基线main `5a6451ca5a5b313fedf9742f1e20bd3ffb0e10e8`。04规约#23、合同#25已合入。#25由小张对50a08d1真实批准5854809503后正常合入，PR完整CI42973849505、main42974418782均成功；回读四个实际镜像扫描报告，HIGH/CRITICAL均0，frontend libxslt为1.1.43-r4。小陈未代其批准或冒称自己合并。

## 实现范围

独立materials领域处理文本/码点/配额，mysqlstore事务持久化，httpserver只处理HTTP边界，identityapp装配。六个04资料操作在同一候选原子标current；8个既有Schema不另造类型，配置/服务/身份/健康及01六个已发布SQL保持原义。000004新增资料、幂等与片段表，真实摘要登记；server与admin精确目标4，前向修复先检查已有对象，无生产down/force。

## 场景与实际用例

| Scenario | 用例/断言 |
| --- | --- |
| MR-SC-01/02 | materials_test与real integration：双班教师、同班两学生、列表/详情/原字节下载；匿名/失效401、外班与不存在同构404、学生写403、Origin/伪造头、真实切班/退出/撤权后旧凭证失效，无拒绝副作用 |
| MR-SC-03/04 | 稳定分页/同快照count，重复未知非法query；UTF-8、BOM/CRLF、码点标题、原字节上限、总流上限、非法控制字符；原始下载不做规范化 |
| MR-SC-05/06 | 8并发真实唯一记录、同键异载荷409、跨班同键隔离、创建事务两个位置注错全回滚；用户固定窗口并发/第13次/Retry-After/切班不重置 |
| MR-SC-07 | 半索引注错回滚并failed；子进程提交资料后直接退出，父进程确认pending与学生不可见；新Store并发显式重试仅一套片段 |
| MR-SC-08 | 空库→4及带01数据3→4；三条DDL逐条中断/dirty阻断/前向恢复；缺错摘要和结构漂移阻断；真实mysqldump隔离恢复3/保留4、实际旧制品拒绝4并在恢复库运行；查询deadline504/连接不可用503 |
| MR-SC-09/10 | 中文/非BMP、大小写敏感字面%/_、2000码点/200重叠、稳定次序及原文区间回查；外班和空结果、损坏片段503、非法模式400 |
| MR-SC-01/08/09生产链路 | 默认Nginx→生产server→可信TLS MySQL上传/字面检索/引用回查/原字节下载；数据库重建及完整服务重建后同键200/同id/原文与片段保留 |

单元和合同通过不代表上表真实DB场景已执行，以下分开记录。

## 本机结果

Windows，Node24.22.1、npm10.5.0、Go1.27.3。未触碰原四份未跟踪文本。

| 命令 | 结果 |
| --- | --- |
| npm run check | 退出0；基础/门禁、合同16组、身份接线/前端回归、类型/构建、Go vet/shuffle/test/build、strict8/8全部通过 |
| npm run audit | 退出0；根与frontend均0漏洞 |
| go test -tags=integration -run '^$' ./internal/integration ./internal/integration/wiring | 退出0，仅证明编译；未连接数据库 |
| MR-SC-02授权红绿 | 暂时移除教师动作检查，测试检测到学生触达持久写、退出1；逐字节恢复原源码后测试退出0，见[原始结果](red-green.json) |
| npm run secret-scan | 首次历史0/暂存1：匹配的是未改变的000003 down SQL公开摘要在diff上下文中的旧误报。逐字节保留旧六项行，追加分隔逗号单独成行后复跑，完整历史及暂存均0；未修改扫描器、规则、例外或范围 |
| npm run verify | 退出1；Docker命令ENOENT，镜像扫描及真实容器验收未运行；不算通过 |

## 首轮完整CI与后续边界补证

[PR #26](https://github.com/zwh9616/campus-claw-plus/pull/26)，源码636f0a4；[完整CI42979621938](https://github.com/zwh9616/campus-claw-plus/actions/runs/42979621938)实际success，check/audit/secret-scan/verify全部退出0。已回读job130386705416原始日志：生产HTTPS、主机入口、数据库停机/恢复、保留卷完整重建、真实身份/资料集成、三个DDL断点及旧制品构建、真实备份/隔离恢复均通过。下载实际artifact13837430857，backend/admin/frontend/mysql四份扫描HIGH/CRITICAL均0；这是本候选CI执行，不能写成小张本机复测。

本次再补MR-SC-03在count与page之间从另一连接真实插入的快照断言，MR-SC-08真实MySQL SLEEP查询超时504、连接不可用503后同一查询恢复命中，以及MR-SC-09跨片段完整查询/大小写空结果。仅测试钩子与边界断言新增，标准入口未绕过；独立单元/集成编译通过，完整本机check再次0。CI增加保留已脱敏identity/wiring/gate原始JSON，避免只保留镜像报告而丢失具体运行用例。新head完整CI结果需另核，不能沿用首轮绿灯代替。

tasks2.1—2.4/2.6待新增边界的完整CI后收口；2.5合同/装配/规则同步已完成。小张3.1独立终审、正常合并及main复验和归档均未执行。
