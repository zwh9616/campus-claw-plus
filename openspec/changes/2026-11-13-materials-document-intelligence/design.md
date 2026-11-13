## Context

基线main 7f0f32f60e9edf805f4ae548896e330ec8d6e5c3；01/02/04/05及06资料阶段已验收归档，22 current、Target=5，#43小陈实际批准5886559717及main CI43371464541已核对。04旧合同的256KiB TXT、原Citation和关键词语义保持；历史归档不修改。组长2026-11-13要求04E全部由小张负责。

## Goals / Non-Goals

阶段A让教师直接上传常用文本型PDF/`.docx`，本班学生能搜索、核对出处并下载原件。阶段B解决扫描件，C解决换种表达的检索。每阶段单独交付、记录实际结果，均不得以接口/测试样例冒充真实运行。产品仍使用“资料、班级、出处”；API内部Document类型不改变用户术语。旧`.doc`需用户先另存为`.docx`，不接受宏格式或密码，不执行嵌入对象、脚本、外链或文档指令。

## Decisions

### D0 责任、前置与第一批准入

本变更规约、合同、前后端、测试、实际验收及问题修正均由小张负责；在collaboration登记仅04E的组长范围例外，不伪造第二成员或独立会话。当前G2/G3保持。首PR是A规约及机器合同冻结：六操作为frozen，22 current与运行Target5不变。该PR须按远端真实保护获批并正常合入、集成复验后，才能apply运行代码。此门禁不因统一负责人而删除；远端需要其他有写权限账号批准时只承担真实PR批准，不转移04E实施责任。

### D1 兼容与六个候选操作

新增独立Document资源承载二进制、异步状态及页/块位置，避免改变已验收Material/Citation、原TXT下载和05 Task含义。新增操作均Bearer，服务端会话提供当前班级，D2顺序仍为认证→动作→资源→业务；教师仅写任教当前班，学生只读ready。外班与不存在统一404；未授权读无存在性差异，无副作用。Origin若存在必须可信同源，不能信任客户端班级、角色或owner字段。

| 操作 | 成功 | 输入与失败 |
| --- | --- | --- |
| POST /api/v1/documents | 202 Document | multipart恰好title/file、必需Idempotency-Key；400/401/403/409/413/429/503/504 |
| GET /api/v1/documents | 200 DocumentPage | page默认1，page_size默认20最大50，ID倒序；400/401/403/503/504 |
| GET /api/v1/documents/{id} | 200 DocumentDetail | 仅path ID，无query/body；400/401/403/404/503/504 |
| GET /api/v1/documents/{id}/download | 200 原二进制 | 授权范围同详情；400/401/403/404/503/504；attachment/no-store/nosniff |
| POST /api/v1/documents/{id}/retry | 202 Document | 无query/body，失败可重试原因且累计attempts<3；400/401/403/404/409/429/503/504 |
| GET /api/v1/document-search | 200 DocumentSearchResponse | q Trim后1..2000码点，mode只keyword，top_k默认4最大10；400/401/403/503/504 |

q的Schema复用KeywordSearchParameters.properties.q：原值URL解码后先Unicode White_Space TrimSpace，再校验规范化q的字符串/1..2000码点/无控制字符；原值边界空白不计规范化长度。page必须整数、minimum=1、default=1，合同守卫精确断言这两个实际参数Schema，不能只检查x说明。所有未知/重复输入400，ID为1..9223372036854775807十进制字符串；空/负/溢出拒绝。HTTP数据库预算仍5秒，健康每请求真实MySQL Ping/3秒/原载荷；解析不放进HTTP事务或这个5秒预算。读取失败503/504，禁止降为200空结果。写配额与原04上传/重试按同一用户共享12次/Unix分钟，切班或幂等重放不重置；429有Retry-After。00既有Error错误码集合不增加；解析失败是Document.failure_reason，不把已接受202追改成400。

### D2 A阶段输入、状态与幂等

title先TrimSpace后1..200码点且无控制字符。文件原始字节1..10485760，整个multipart最多10551296；声明和流式实际大小都校验，超限413。文件扩展名只`.pdf`/`.docx`（不分大小写），签名须分别为PDF或ZIP；content-type仅为提示，不能只信任它或扩展名。非法格式400，扫描件不提前假报可检索。复杂结构、密码和损坏可在异步解析发现后落failed，GET如实显示原因。原始上传文件名不进路径/日志/响应，不跨资料复用下载令牌。

状态为queued→processing→ready/needs_ocr/failed。ready之前body=null、locations空，学生列表和搜索不可见；任一非空白PDF页只有图像且无可提取文字时，整个资料进入needs_ocr（不把其余页部分文字冒充完整ready），教师可下载原件、页面说明等OCR阶段，不能算A成功文字样本。空白无内容、损坏、加密或资源超限为failed。不得为了凑ready返回乱码/空文本。

幂等键ASCII `[A-Za-z0-9_-]{16,64}`，范围用户/当前班级/键，摘要覆盖格式、Trim后title及原始字节并使用长度前缀。事务内原子写Document、原件、queued解析作业和原202快照；并发20同键只建一份，同键异载荷409；提交后丢HTTP回执可重新授权再重放原202，GET查询后续真实状态。没有模型调用或解析进程处于DB事务内。

### D3 PDF / DOCX提取与出处

解析输出格式固定且所有对象闭合；以保留原始字节的独立文件版本为权威。PDF逐页提取，页码从1起；DOCX按正文XML顺序提取段落及表格单元格段落，逻辑块从1起，明确不伪造Word排版页码。页眉页脚、脚注/批注、图片、公式和复杂版式不保证首版完整还原，语料清单须逐项声明覆盖/不覆盖；发现正文缺失不能笼统声称该文件成功。

正文仅移除一个开头BOM，统一CRLF/CR为LF，不做NFKC改写，保留Unicode正文；页/逻辑块以两个LF分隔，空白块不产生引用。DocumentLocation为kind=pdf_page/docx_paragraph/docx_table_cell、unit>=1、全局Unicode码点半开区间char_start/end；区间不能含其他块或越界。PDF页单元可含换行，DOCX块类型区分普通段落与单元格。DocumentCitation的quote必须逐字等于当前持久正文的这个区间，并与文档版本、页/块一致；URL是受保护站内API路径。

关键词片段最大2000码点，重叠200，不能跨页或DOCX逻辑块；按document id倒序、location unit及片段序号稳定排序。引用最多2000码点。查询和total/列表在同一请求读快照，跨请求不许诺offset分页快照。先按当前班级/ready过滤，再回读同版本持久正文检查quote、位置及授权；损坏503，外班候选永不返回。Document/Citation不复用旧Material ID空间来掩盖类型差异。

### D4 解析隔离与资源失败

生产候选为私有解析服务，仅backend与该服务加入独立internal解析网络，无主机端口、无ingress/data网络、无数据库或模型凭据、无互联网出站。解析器仅接收本次有界字节及format，不能接收路径或URL。每次工作使用临时目录，读取固定文件，不解析宏、嵌入程序或外部资源；成功失败都删除本作业临时文件。服务非root、read_only、cap_drop=ALL、no-new-privileges、tmpfs<=64MiB、memory<=512MiB、cpus<=1、pids_limit<=32；并发上限1。每作业子进程墙钟30秒，超时/OOM需终止并回收子进程，状态失败而非无限processing。

PDF最多200页、解压内容流累计32MiB、规范化正文UTF-8最多2MiB。DOCX ZIP最多2000项、正文逻辑块最多20000、展开总量32MiB、压缩比<=100、XML拒绝DTD/实体，拒绝路径穿越、重复项、加密ZIP及缺失document.xml；实体/外链不访问。文件上限不能替代展开/CPU/内存限制。候选PDF库pypdf7.0.1（BSD-3-Clause）；DOCX先用标准ZIP/XML读取，依赖最终轮子SHA、Python固定镜像摘要、离线安装/许可/漏洞审计须在A实现前锁定并留证。来源见[选型证据](research.md)。

解析服务连接/令牌等只登记planned；精确键、超时、失败路径和镜像清单须与A实现原子激活，当前.env.example不新增非active键。已ready资料、旧TXT、身份及健康不依赖解析服务可用性；解析服务不可用的新上传在原事务前503，不留半份资料。解析中故障按失败状态/可重试语义处理，禁止伪造成功或把错误写入原文。

D4实施顺序补记（2026-11-13）：#45已按远端实际批准正常合入并完成main复验，首个apply子包仅提供离线stdin解析核心及隔离镜像实测，不提供监听端口/网络RPC/数据库/队列/页面。命令仅接格式及有界字节，输出私有结果字段和冻结失败原因；具体协议/限制见[组件说明](../../../document-parser/README.md)。check执行40份固定语料、25类负例与边界；verify在原四生产镜像验收之外另扫候选解析镜像。Compose默认服务、current操作和Target5不变，不把候选镜像或CLI验收计成A全链路交付。私有RPC/active配置及准确DDL仍须先冻结再进行持久集成。

### D5 持久作业、迁移与恢复

预留候选000006（不等于已发布SQL或Target6）：documents、document_locations/chunks、document_parse_jobs及document_idempotency的准确DDL、摘要、结构漂移及隔离恢复5方案，另在A实现前核对。不能修改000001..000005或现有表语义；server/admin届时同提交精确切6。持有人升级须停写/一致备份、离线迁移；失败前向修复，保留新库，在隔离环境恢复5备份验证旧制品。空down仅测试，不用于生产回退。

解析作业独立于05批改Task，不让05开始claim生产任务。轮询1秒、并发1，claim生成owner与递增epoch，lease60秒，20秒heartbeat；写入须完整校验owner/epoch/processing/未过期租约。进程在原件写入、claim及解析结果提交前后真实kill/restart，旧owner不得发布；原子提交正文/locations/chunks/ready，失败回滚。累计尝试最多3次；崩溃后可接管，最终耗尽failed。retry仅允许failed且原因parse_timeout/worker_interrupted/internal_failure、attempts<3，并发只生效一次；ready/needs_ocr/终态不合法重试409。身份切班/退出后旧凭证仍拒绝，日志不写字节/正文/文件名/路径/令牌。

### D6 A阶段页面及真实验收

复用06主题、资料术语和身份客户端，在“资料”内提供“文本资料 / PDF与Word资料”两个明确入口；新列表、上传、详情、原件下载、失败重试和出处页/块定位走Document合同，旧TXT链路不变。路由候选/app/materials/documents、其upload和/{id}，不在current前启用；先制作同版本四态/长内容/360与1440/键盘/原生200%样板，由小张实际核对，再接真实服务。只显示解析后的转义正文，不运行原PDF脚本或Office内容，不把链接当成公开附件。

完整验收须真实HTTPS双班教师/学生、原字节下载、40份清晰文档核心正文、出处逐字/页/块、扫描件needs_ocr及20类负例、真实超时/进程kill/OOM/重试/DB重建、原01/04/05回归及原完整gate、五个生产镜像实扫/同轮运行ID与清理。具体样本和阈值见[验收表](acceptance.md)，目标尚未测量。

### D7 B阶段OCR（正式排期，A真实验收后进入）

B1冻结PDF扫描页/PNG/JPEG的格式、像素/页数/总量与任务预算、语言包、识别引擎/版本/许可、bbox坐标和quality规则；不得直接放开图片上传。B2实现文字层优先、无文字页OCR和中英方向校正；存原页、bbox、识别文本与来源，识别低质进needs_review，不能计ready或充当模型置信结论。B3实现教师核对/修正文并增加版本，旧出处不能漂移；重新生成索引并使旧会话/版本引用失效规则明确。B4执行冻结50页集CER/定位、模糊页拒绝、真实限时/中断恢复/班级隔离与全门禁。此阶段开工前冻结状态、校对写接口、迁移及配置，不能只把A的needs_ocr文案改成ready。

### D8 C阶段语义/混合检索（A可用语料，B验收后进入）

C1先冻结100份资料/1000片段/100问题的标注集、开发/盲测分离、精确模型/维度/版本、分块/索引版本、供应商出站与密钥/预算和降级策略；未定模型不得声称向量能力可用。C2实现按班级和ready版本过滤的向量索引/删除重建、查询嵌入、keyword/vector/hybrid及明确融合规则；返回前回查持久正文，向量payload绝不作为授权依据。C3真实模型/索引评测Recall@5、MRR@10、换表达增益、无答案和200次越权请求；不把mock嵌入或固定检索结果算真实模型证据。C4固定4vCPU/8GiB测p95、tokens/费用、超时/限流/索引落后/模型不可达；vector/hybrid依赖失败503/504，不静默谎报空命中或偷换keyword；用户可明确选择仍可用keyword。真实embedding与索引许可/数据去向批准后才接线，不恢复07教学生成业务。

### D9 阶段完成与证据

A、B、C在tasks分别勾选；每条场景记录实际版本、命令、环境和正常/失败/边界证据。合成合同测试仅证明声明；PDF解析/OCR质量、真实嵌入及另一会话只能以实际执行记通过。每个提交同步共享表04E及关联06行，旧04/06归档保持历史范围。远端保护仍阻断缺批准/缺检查/冲突，按expected_head正常合并、复验main后才记对应阶段完成；整个change须A/B/C任务和主规约同步全部完成后才整体归档，不在A完成时把未做的B/C一并归档。
