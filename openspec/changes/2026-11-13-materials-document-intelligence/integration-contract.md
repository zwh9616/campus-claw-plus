# A1后半：私有解析接线候选合同

小张统一负责。基线main9263d21，#44的18组05/五恢复/三HTTPS及12项批次守卫保留；#46核心及#47收口均已合入。本文须与机器合同、精确候选DDL、正反例和原检查一并获审合入后才实施接线。本批不创建服务/监听端口，不改22 current、Target5、active配置、样例或已发布SQL。

## I1 内部协议与失败

仅backend与document-parser加入独立internal解析网络。后端固定目标`http://document-parser:8091`，仅`GET /health`与`POST /v1/parse`；无userinfo/path/query/fragment/重定向或通用URL输入，不解析用户主机名。容器不发布主机端口、不加入ingress/data，不取得DB/模型秘密、无互联网出站。此精确受控目标先frozen，当前出站例外仍不激活。

两操作都要求`Authorization: Bearer <DOCUMENT_PARSER_TOKEN>`，验证后再读正文；缺失/错误401、重复认证头400，秘密恒定时间比较。GET无body，成功200仅`{"status":"ok"}`；忙碌时仍表示服务存活，不代表空闲。POST仅原始PDF/DOCX字节，Content-Type为精确两种已登记MIME并映射format，禁止路径/URL、文件名和用户/班级/任务字段。Content-Length必需且1..10485760，与实读相符；Transfer-Encoding、未知查询、重复参数/Content-Type/Content-Length均400。头总量<=8KiB、读头/读体各<=5秒；全请求<=35秒。不记录字节/正文/文件名/路径/令牌。请求完成日志只写服务生成request_id、受控路径/状态/耗时。

解析并发1，队列在MySQL而非HTTP服务；忙碌POST立即503/error=busy，不在服务内无限排队。子进程沿用30秒/384MiB，容器1CPU/512MiB/32PIDs/read_only/nonroot/cap_drop/no-new-privileges/64MiB tmpfs；单JSON响应<=8MiB。客户端连接1秒、响应头32秒、整个RPC35秒（包含传输/读体），禁止自动重定向/代理环境或发送用户URL。ready/needs_ocr为200；确定性解析失败corrupt/encrypted/unsupported_content/resource_limit为422；parse_timeout为504；worker_interrupted/internal_failure为503。400/401/404/405及busy是闭合内部错误对象，不伪造ready。响应结构/状态与原因冲突、超大JSON/未知字段/不合法出处必须拒绝为internal_failure；连接断开/服务忙为worker_interrupted，总预算到期为parse_timeout。每个已claim尝试均计数，三次封顶。

后端必须在JSON解码前严格验证UTF-8、拒绝重复字段/不成对surrogate/超过16层嵌套和未知字段，禁止解码器静默替换非法字符。body须UTF-8<=2MiB、非空、无CR或TAB/LF以外控制字符；解析器仅去一次初始BOM和统一CR/LF，客户端不再改写/二次去BOM。按Unicode码点逐位置验证有序/不跨页或逻辑块、完整覆盖且两LF分隔、PDF页数范围和Word不造页码。私有Schema是结构约束，位置/状态语义同现有DocumentDetail验证，不以JSON Schema代替原文回查。RPC只返回解析结果，不返回可授权的用户/班级/文档ID；结果进入DB前仍需完整owner/epoch/processing/未到期租约CAS。

## I2 配置和原接口隔离

只冻结两个未来必需键：`DOCUMENT_PARSER_URL`（backend/Compose，精确内部origin），`DOCUMENT_PARSER_TOKEN`（backend/parser/Compose，同一32随机字节的43字符无填充canonical base64url）。无默认值；空白、缺失、非canonical/错误长度均启动非零，错误不回显原值。令牌仅本机.env/进程环境、不进Git/镜像/日志。解析进程固定8091，不复用后端HTTP_PORT、不新增任意端口开关。环境变量只在未来原子激活提交进入样例，值为空。

激活时server验证必需配置但不因解析服务暂时失联而拒绝已有身份/TXT/ready读取，公开/health仍唯一MySQL Ping3秒。新上传依次认证/动作/流式边界/幂等摘要→查已提交原快照→仅新请求在事务前进行500ms解析服务健康预检；不可达503，总公共HTTP预算仍5秒，预检/解析不在DB事务内。已提交同载荷重放在重新授权后返回原202，即使解析器失联；不能把新依赖检查放在已提交重放前。持久worker的RPC35秒单独预算，DB各事务仍5秒，原旧读取不依赖解析器。

## I3 精确候选迁移000006

唯一候选字节在`docs/contracts/document-parser/migration/000006_documents.{up,down}.sql`，摘要由机器合同绑定；位于backend embed目录之外，当前admin/server不会发现/执行它。五DDL按documents→locations→chunks→parse_jobs→idempotency建表，down严格逆序。原件10MiB、正文2MiB、版本1/状态/尝试<=3、码点界限及租约非空条件有CHECK；复合FK绑定同文档/班级/版本，幂等快照再绑定原创建人，VARBINARY保留原键case/尾字节。索引按班级ready及文档倒序、页块顺序、作业可投递/租约稳定排序。精确列/类型/可空/索引顺序/FK schema+table+列序、CHECK表达式及引擎/字符集/排序在实现结构探针中检查，不能仅查表存在。

SQL无法跨行校验完整正文、locations/chunks和ready或旧owner权威；必须在结果事务中先CAS锁定有效owner/epoch/processing/lease>DB UTC_TIMESTAMP(3)，验证同版本原文和原件SHA，再全写位置/片段与ready及job closed。失败全部回滚。位置PK按含空白的原unit，片段<=2000码点、重叠200，不跨位置；读取时重查持久原文，索引quote不作权威。queued创建原件+job+精确原202字节快照同事务；attempt0，job pending/epoch0。claim原子递增attempt/epoch、生成32hex owner/lease60秒；20秒心跳、1秒轮询、并发1；过期processing可接管但最多3次；三次耗尽记failed/worker_interrupted并关闭job，不开第四次。普通解析failed关闭job，仅既定三种可重试原因且attempt<3才显式retry CAS置queued/job pending，清旧owner/lease，保留epoch和累计attempt，不改原202。

### 实施与恢复退出条件（DI-SC-07..10/15）

实施PR把上述候选逐字复制到backend SQL、追加真实manifest/identity-phase、server/admin原子精确Target6、增加结构/repair6和空库down6门禁；不改000001..000005，不自动迁移/force/down。SQL候选存在不等于任何库已升级。

真实演练必须使用已验收Target5制品和本项目隔离MySQL：停写→一致mysqldump（包含数据/会话/05 pending、原SQL摘要、UTC时间与制品ID）→升级6→校验身份/TXT/05及新资料。五DDL每一步真实中断；dirty/摘要/列/索引/FK跨schema或次序/CHECK/引擎/排序漂移均阻断。repair6仅显式前向补全并在全结构/摘要一致后清dirty，不能盲force；实际5制品拒绝6。升级失败保留6库，在另一个隔离库恢复5备份，以同一已验收5制品复验账号/原资料字节/05幂等与pending，再记录实际RTO、数据边界及连接切回；不承诺备份后6新增写入出现在5恢复库。

down仅所有五新增表完全空且显式可丢弃测试库允许，逐表检查，不以只查documents为空代替；有一行（包括job/幂等）即拒绝。持有人生产升级、备份秘密和切换另由持有人执行，不伪造本机/另一机器通过。真实20并发同键/异载荷/回执丢失、claim与提交前后kill/restart/过期owner、OOM/RPC失联/取消信号、默认HTTPS双班和原18组05/五恢复/三HTTPS/12批次及五生产镜像全门禁均仍待实施后实际验收。

## I4 本批可证明和不可证明的事项

本批结构正反例经独立2020-12与私有OpenAPI解引用双路径一致验证；语义例只验证有界结果/状态/出处合同，候选SQL摘要/五表顺序/约束和基线不激活由检查覆盖。受控退化必须红→逐字恢复绿。本批无运行HTTP/RPC、无Target6、无DB迁移/并发/恢复成功结论，不勾A4或整体归档。准确运行证据由后续实施提供；任务和共享表本提交同步全部小张负责。
