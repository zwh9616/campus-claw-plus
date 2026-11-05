## Context

基线main 2bf12e2，现有React18/Go net/http、双容器、npm门禁和v0.0.1-skeleton历史。当前/health返回status=ok、dependencies={}，生成32位十六进制X-Request-ID；没有登录、数据库或教学业务。按2026-11-04协作手册v2，00仅小葛/小张互审。本文所有业务字段是待小张审查的冻结候选，不是已运行接口；禁止复用个人旧Python仓库的实现结论。

## Goals / Non-Goals

**Goals:** 让01/02/03/10可以独立起草并清楚知道何时允许apply；00实现仅落公共契约、规则、检查和证据模板，不生成整套业务。

**Non-Goals:** 不在00实现业务端点/数据库/任务/LLM；不更改现有健康载荷；不将第7课归档例外推广成后续免评审；不代小张批准。

## Decisions

### D1 契约文件与兼容边界

小张apply后生成docs/contracts/openapi.yaml（OpenAPI3.1.0）、schemas/*.schema.json（JSON Schema2020-12）、change-dependencies.md、migration-register.md与规则对齐表。schemas至少包括Principal、Error、Page、Citation、Task、SSE、SkillInput、GradeResult、Audit；以schemas/*.schema.json为唯一类型源（$schema=https://json-schema.org/draft/2020-12/schema），OpenAPI通过$ref引用，不手写第二份同名类型。OpenAPI jsonSchemaDialect固定https://json-schema.org/draft/2020-12/schema；nullable用type联合null或oneOf，不用3.0 nullable。所有对象additionalProperties=false、必需字段明确，引用可解析；同一批正反例同时经独立2020-12校验与OpenAPI解析后的解引用Schema校验，逐例接受/拒绝必须一致，不仅验证YAML语法。工具须明确支持3.1/2020-12并锁版本；不兼容即阻断00落地，不降级方言。依据：https://spec.openapis.org/oas/v3.1.0.html#schema-object 。OpenAPI按D9区分current/frozen/planned：health是current；01/02需要的auth/me契约是frozen但未实现；后续候选只进入待冻结登记，不生成可调用operation或任意object占位。规则版本business-contracts/v1；字段变更先改00、列受影响change，再改实现，兼容破坏使用新版本路径或双方确认迁移。

### D2 通用字段与HTTP

- 业务路径/api/v1/，资源ID为正十进制字符串，正则^[1-9][0-9]{0,18}$且数值不大于9223372036854775807；禁止JS number精度损失。version为正整数；时间UTC RFC3339毫秒，例如2026-11-04T08:00:00.000Z；金额/分数用整数百分之一分，不使用浮点。UTF-8 JSON，未知字段/重复JSON键拒绝400；JSON普通请求最大64KiB，超限413，上传例外由04明确最大字节数。
- 成功对象直接返回资源，列表返回{items:array,page:int,page_size:int,total:int}；page默认1、page_size默认20上限50；筛选/排序只接受各端点白名单，非法400，不退化成全量。排序以id作为最终唯一键；跨页稳定性承诺针对相同数据快照，并发写入不承诺offset快照隔离。
- 错误固定{error:{code:string,message:string,fields:array<{field:string,reason:string}>,details:null|{turn_id:ID,turn_url:string}},request_id:string}，request_id等于响应X-Request-ID；message不含SQL/堆栈/内部地址。资源不存在及跨班统一404/NOT_FOUND/message=资源不存在/fields=[]，除request_id外一致。
- HTTP400 VALIDATION_ERROR；401 UNAUTHENTICATED（缺失/无效/失效会话）；403 FORBIDDEN（合法身份无动作权限、CSRF失败）；404 NOT_FOUND；409 CONFLICT（版本、同键异载荷、状态/截止冲突）；413 PAYLOAD_TOO_LARGE；429 RATE_LIMITED（Retry-After整数秒）；503 DEPENDENCY_UNAVAILABLE；504 UPSTREAM_TIMEOUT。未知路径404、错误方法405（Allow头）；既有骨架非业务错误暂保持当前行为，在各API引入时统一，不倒改旧证据。
- 处理顺序：公开路由按登记；其余先认证，再动作角色，再本班/本人资源授权，再详细业务验证与副作用。未认证401优先；学生写教师功能403；同角色跨班资源404。畸形HTTP/传输超限可在认证前拒绝，需端点测试明确。拒绝无业务/文件/向量/队列写入，安全审计写入是声明的唯一例外。

### D3 Principal与会话（01实施，小张收口）

Principal={user_id:ID,role:teacher|student,class_id:ID,session_id:string,session_version:int,expires_at:timestamp}，仅来自服务端验证令牌和成员关系，不接受客户端role/class_id决定授权。教师只操作任教班，学生只操作所属班及本人会话/提交；切班须验证成员关系并签发新上下文，旧班缓存清空。01用双班四身份A教师/A学生/B教师/B学生及同班第二学生测私有归属。

冻结公开端点仅GET /health、POST /api/v1/auth/login；POST /api/v1/auth/refresh与GET /api/v1/auth/csrf不要求访问令牌但必须验证刷新Cookie所对应的有效服务端会话，不是匿名放行；其他默认访问令牌保护。POST login输入{username:string(1..64),password:string(1..128)}，输出{access_token:string,expires_in:int,principal:Principal}，刷新Cookie另发；登录错误统一401不暴露用户名是否存在。GET /api/v1/me返回Principal；POST /api/v1/auth/logout返回204并撤销会话；POST /api/v1/auth/switch-class输入{class_id:ID}输出同login结构，不属于该班403且不切换。

访问令牌仅前端内存、15分钟过期；刷新令牌服务端存摘要、7天过期且轮换，Cookie HttpOnly/Secure/SameSite=Strict、Path=/api/v1/auth。refresh/logout/switch-class等Cookie参与的写操作同时检查同源Origin与X-CSRF-Token（绑定会话的随机值，GET /api/v1/auth/csrf在验证刷新会话后返回{csrf_token:string}，禁止跨源读取/宽松CORS；前端仅内存保存），失败403，不放宽生产Cookie。开发无HTTPS时只允许显式隔离开发配置，01规约须写适用范围，不自动降级。登出/改密/撤权立即使访问与刷新失效，需服务端会话版本检查；JWT本地验签不能替代撤销检查。

### D4 出处、检索和资料（04实施，小陈）

Citation={material_id:ID,chunk_id:ID,material_version:int,title:string(1..200),ordinal:int>=0,char_start:int>=0,char_end:int>start,quote:string(1..2000),url:string}，位置以规范化提取正文的Unicode码点半开区间计，正文版本不可漂移。url为受保护的站内相对地址，不是公开附件目录。读取/检索先班级过滤，再回查持久库授权和原文位置；向量payload不是权限依据。索引状态pending|indexing|ready|failed|deleted，非ready不检索；失败可显式重试，不能假报ready。

GET /api/v1/materials按Page返回材料，GET /api/v1/materials/{id}授权原文。GET /api/v1/search?q=...&mode=keyword|vector|hybrid&top_k=...，q为1..2000字符，top_k默认4、范围1..10；返回{items:Citation[],mode:enum}；无命中200空数组，跨班专属内容空，直接读跨班ID404；依赖不可达503而不是空。04细化上传/下载路由和容量前先更新契约，不把占位描述当已冻结接口。

### D5 任务、幂等与成绩（05/08实施，小张，小陈确认结果格式）

候选POST /api/v1/assignments/{id}/submissions输入{answer:string(1..20000),assignment_version:int}，头Idempotency-Key为16..64可打印ASCII。处理优先级固定：先重新认证、动作与当前班级/资源授权，再查作用域user_id+class_id+route+assignment_id的已提交幂等记录；拒绝认证/授权不返回旧受理记录。已提交同键同载荷直接重放保存的原202 {submission_id:ID,task_id:ID,status:"pending"}，不再用当前截止时间或作业版本否定原提交；pending是原始受理快照，当前状态必须GET task查询。已提交同键异载荷409 IDEMPOTENCY_CONFLICT，优先于截止/版本冲突。不存在已提交记录（包括新键）才检查当前作业版本、服务端时间>=deadline及其他新提交条件，失败409且不写记录。请求重放仍检查该用户当前是否有提交动作权限，但不把截止时间本身解释为权限撤销。

202仅在submission/outbox/幂等响应快照同一事务提交后返回；原事务尚未提交时并发请求通过唯一约束/锁串行化，不能返回未提交快照；失败回滚后按新请求处理。键绑定规范化载荷摘要，不靠先查再写；记录至少保留到作业归档后7天，05需审定清理策略并向调用方明确有效期，不能静默丢失去重保障。必验：截止前事务成功但202丢失→截止后原202；权限撤销→401/403/404按授权层拒绝；同键异载荷→409；新键逾期→409；版本变化旧键复用/新键拒绝分别断言DB数量。

Task候选={task_id:ID,submission_id:ID,status:pending|running|succeeded|failed|cancelled,attempt:int(0..3),execution_epoch:int>=0,version:int>=1,cancel_requested:boolean,created_at:timestamp,updated_at:timestamp,error:null|{code:string,message:string}}。本人/授权本班教师可读，跨班/他人学生404。pending→running→succeeded|failed|cancelled；pending可直接cancelled，running取消只置请求标记，worker确认后才终结。

R6执行准入：首次持久化任务attempt=0、execution_epoch=0；每次成功领取执行权（首次、崩溃租约过期接管、显式重试后领取）都原子增加attempt与单调execution_epoch，最多3次。重复消息但未领取不消耗attempt；显式retry只把failed改pending，不立即增加attempt，attempt=3拒绝409 RETRY_EXHAUSTED。第3次执行租约过期未提交结果则failed/RETRY_EXHAUSTED，不再领取；failed可来自明确错误或耗尽，前两次可按1/2秒退避进入pending。租约60秒，续租只允许当前epoch/执行者且租约未过期。

任何worker结果、续租、失败或取消确认提交必须同时匹配task_id、当前execution_epoch/执行者、running状态及未过期租约；成功结果另要求cancel_requested=false。权威时间取数据库时间。旧worker即使尚未被接管，只要租约过期也无权提交；被接管后epoch失配同样拒绝，不更新任务/成绩/错题/outbox，不产生业务完成事件（可写独立拒绝审计）。当前代次的任务终态与成绩/错题/outbox在同一事务中提交。取消标记先提交则成功CAS失败并最终cancelled；成功先提交则取消返回409 TASK_TERMINAL，不改终态。05/08必验A超时被B接管后A恢复、同代重复结果、三次耗尽/手动重试、取消成功竞争及事务注错回滚；锁/CAS具体实现由05/08选，不能弱化上述写入条件。模型/消息网络必须在事务外。

GradeResult={schema_version:"1",submission_id:ID,submission_version:int,rubric_version:int,skill_id:string,skill_version:string,items:[{criterion_id:ID,score:int>=0,max_score:int>=0,reason:string(1..2000),citations:Citation[]}],total_score:int>=0,max_total:int>=0}。items需与rubric分项精确对应且无重复；score<=max_score，max由rubric核验，total等于sum且<=max_total；单位为百分之一分。模型只返回建议数据，不写成绩。AI结果进入pending_review，教师以expected_version确认/改分后published；迟到AI不得覆盖人工结果。PUT /api/v1/submissions/{id}/grade输入{expected_version:int,items:[{criterion_id,score}],reason:string(1..2000)}；教师改分并发冲突409无半写入。08细化发布与错题API，在冻结前不可自行猜接口。

### D6 SSE与技能（07A/B/C顺序实施，小陈）

POST /api/v1/conversations/{id}/messages输入{client_message_id:string(16..64),content:string(1..2000)}；进入SSE前完成授权/容量/依赖检查，失败返回正常HTTP错误。相同client_message_id与内容返回既有turn当前状态（409 TURN_EXISTS，error.details={turn_id,turn_url:"/api/v1/conversations/{id}/turns/{turn_id}"}，不重复写消息）；异内容409。

text/event-stream、UTF-8、禁缓存；每帧event+data JSON，以空行结束。meta={request_id:string,turn_id:ID,conversation_id:ID,assistant_version:int,citations:Citation[],skill:null|{skill_id:string,skill_version:string}}恰一次在首；token={turn_id:ID,seq:int>=1,text:string}顺序递增。连接可写时终结只能二选一：done={turn_id:ID,status:"completed",usage:Usage|null,usage_unavailable_reason:null|"provider_unavailable",duration_ms:int>=0}或error={turn_id:ID,code:string,message:string,retryable:boolean}，终结后无正文。Usage={input_tokens:int>=0,output_tokens:int>=0}，两字段均必需；未知用量为null并标原因，不编造0；Usage为对象时原因必须null。心跳为注释，不计正文。07C新增tool事件需先修订00。

取消候选POST /api/v1/conversations/{id}/turns/{turn_id}/cancel返回202 {turn_id:ID,status:"cancel_requested"}仅表示受理，服务端关闭上游并争取终态。取消在完成前先原子获得终态则持久化cancelled；连接仍可写时发送error {turn_id,code:"CANCELLED",message:"已取消",retryable:false}作为唯一终结，不发送done。完成先提交则取消409 TURN_TERMINAL且保留completed；并发重复取消已cancelled返回200 {turn_id,status:"cancelled"}。终态与事件发送通过同一turn的串行出口协调：先提交终态再尽力发送对应唯一终结；取消失败不得追加第二终结。

连接已断时不承诺任何终结帧送达，也不补发虚假done。若完成/取消尚未赢得终态，断网或超时持久化partial（已有非空正文）或failed（无正文），释放上游；可写的超时连接发送error UPSTREAM_TIMEOUT、retryable=true。网络故障可写时error STREAM_INTERRUPTED、retryable=true；其他依赖/生成错误error GENERATION_FAILED、retryable=true。已赢得completed/cancelled的状态不被断网改写。用户重试须显式新client_message_id，不自动二次付费调用。

Turn候选={turn_id:ID,conversation_id:ID,status:generating|completed|partial|failed|cancelled,text:string(0..100000),last_seq:int>=0,version:int>=1,error:null|{code:string,message:string,retryable:boolean},updated_at:timestamp}；GET /api/v1/conversations/{id}/turns/{turn_id}返回持久化快照，生成中只保证已落库部分而非尚未提交token。completed.error=null，其余失败/取消有对应error；生成中error=null。07A必验仍连接取消meta/token/error CANCELLED、断网后查询、空输出失败/已有正文partial、取消与成功双时序且唯一终态。

SkillInput={skill_id:string,skill_version:string,principal:Principal,request_id:string,question:string,submission_id:ID|null,rubric_version:int|null,citations:Citation[]}；principal只由主机注入。技能标识guided-solving/grading/error-explanation；只从本班启用版本中选择，未授权技能/工具拒绝并审计。07B批改返回GradeResult；解题/讲解走07A文本且遵守不给最终答案/标准答案的教学规则；语义效果须真实模型评测，不用关键词匹配冒充。单轮最多4次工具、模型总60秒、资料上下文12000码点，超限受控错误。资料和工具结果是数据不升级为系统权限。

### D7 MCP、审计、配置与健康

03是独立工具服务，协议JSON-RPC2.0、POST /mcp、GET /health；initialize/tools/list/tools/call，令牌环境注入；工具question:string输入、文本输出；鉴权401。07C宿主逐次核验Principal/资源归属，模型不能决定class_id。默认拒绝SSRF私网、环回、链路本地及重定向；唯一新增候选例外http://mcp:8090/mcp，供宿主调用受控Compose MCP服务，精确匹配scheme/服务/端口/path、禁止URL用户信息/query/fragment/重定向，校验解析目标确属本项目网络服务。未获03/07C审查及部署证据前不启用；不允许通用CIDR白名单。工具超时10秒、文本<=8000字符、清单<=100工具，由03/07C具体场景验证。

Audit={audit_id:ID,request_id:string,actor_id:ID|null,class_id:ID|null,action:string,object_type:string,object_id:ID|null,result:ok|denied|error,skill_id:string|null,skill_version:string|null,usage:Usage|null,duration_ms:int>=0,created_at:timestamp}；匿名拒绝actor/class为null，不能信客户端班级；不记原始正文/密码/令牌。教师GET /api/v1/audits仅查本班分页，学生403；匿名或无法归班的安全记录不暴露给教师。安全审计失败时高风险变更不执行且503；普通读取可返回已授权结果并有运维告警，10补可靠持久化。

当前/health及镜像探针保持原样。引入必需依赖的change同时更新响应、探针、测试及规则：检查必需依赖down→503，不宣称未接依赖健康；LLM暂时失败不等于所有资料浏览不可用。数据库readiness失败禁止依赖它的业务流量。新增键只能空值键名，不能写HTTP_PORT=8080；配置登记含所有者、阶段、必需/可选、缺失行为与超时。00不提前扩.env.example；01登记DB/会话键，03登记MCP令牌键，07登记模型键，10部署只提供运行时值；不输出值。

### D8 阶段与文件责任

2026-11-05组长更新协作流程：审查者直接修复、验证、提交并正常合并，不再因修复而强制反向再审，具体见[协作规范](../../../docs/standards/collaboration.md)与reviewer-fix-workflow变更。下述两人分工、业务依赖及G2/G3仍有效；旧审查结果不冒充新批准，历史证据不改写。

准入状态：G0=规约草案/返修；G1=小张对当前规约head明确批准，允许小张apply **00本身**；G2=00机器合同/规则/检查实现经小葛终审、按远端门禁合入main并记录集成SHA、集成复验通过；G3=10前置门禁经小葛终审并合入main，证明本地/CI失败真正阻断。G1不放行业务apply。所有下游（含02、03和其他业务）apply必须G2+自身规约批准+表内依赖；10前置门禁apply只需G2+自身批准，避免循环。所有业务实现PR（01..09、11..13）的正常合并均须G3，不因mock/纯前端而例外；规约PR与00/10门禁自身PR不受尚不存在的G3阻塞，但仍须现有CI和两人审查。无叠加分支例外；不在未合并00上自行apply。03/10提前准备仅表示G0文档草案。

| 变更 | 起草 | apply前置 | 合并及真实验收前置 | 规约终审/实现 |
| --- | --- | --- | --- | --- |
| 00 | 最新main | G1，仅允许00合同规则落地 | 小张实现合同规则，小葛终审与集成复验，真实新会话证据后归档 | 小葛/小张 |
| 01 | 可提前 | G2+自身规约批准 | 10门禁前置生效；双班四身份/失效真实数据库验收 | 小陈/小张 |
| 02 | 可提前 | G2+自身规约批准 | 局部mock测试单列；01可用后真实登录联验 | 小张/小葛 |
| 03 | 可提前 | G2+自身规约批准 | 10门禁；真实协议/鉴权/容器，宿主联验等07C | 小葛/小陈 |
| 04 | 00后 | G2+自身规约批准；01可用 | 授权存储和索引真实联验 | 小张/小陈 |
| 05 | 00后 | G2+自身规约批准；01可用 | outbox/worker崩溃重复恢复；假批改不等于07B通过 | 小陈/小张 |
| 06 | 接口提前 | G2+自身规约批准；02可用、04/05合同确认 | 等04/05真实接口逐项联验 | 小张/小葛 |
| 07A | 接口提前 | G2+自身规约批准；01/04可用 | 真实模型/取消/流式失败 | 小葛/小陈 |
| 07B | 可提前 | G2+自身规约批准；07A终审通过 | 固定15题含>=3拒绝反例与真实模型评测 | 小葛/小陈 |
| 07C | 可提前 | G2+自身规约批准；07A/07B终审通过、03可用 | 真实发现绑定调用、断开拒绝审计 | 小葛/小陈 |
| 08 | 格式确认后 | G2+自身规约批准；05可用、GradeResult冻结 | 07B真实闭环、人工优先/事务回滚 | 小陈/小张 |
| 09 | 可提前 | G2+自身规约批准；02/06可用、AI合同明确 | 07A/B/C/08真实接齐 | 小张/小葛 |
| 10 | 可提前 | G2+自身规约批准 | 前置门禁先落地；增量接线；最终服务就绪/告警/恢复分别验收 | 小葛/小陈 |
| 11 | 计划提前 | G2+自身规约批准；本change批准、对应真实业务可测 | 09与各真实路径可用；小张独立复测 | 小张/小葛 |
| 12 | 计划提前 | G2+自身规约批准；09/10/11通过 | 同一候选公网/压测/三人反馈/恢复 | 小葛/小陈 |
| 13 | 证据归集 | G2+自身规约批准；12通过、各真实记录齐全 | 报告链接核对/彩排/实际课程提交另记 | 小陈/小葛 |

目录协调窗口：小葛负责frontend及前端锁的冲突协调；小张负责公共Go入口/身份/迁移编号；小陈负责AI/RAG/MCP、Compose/镜像/CI。这不是固定技术实现分工，实际编码/审查按每个change两人表执行；跨目录变更说明影响并请窗口协调，不新增第三审批。共享装配走小PR，两位变更负责人检查自身迁移，不增加固定第三审批人。review绑定head SHA，关键改动需复审；归档需集成版本实测，起草完成不算apply批准。

### D9 冻结端点矩阵与类型完整性（R5）

current仅GET /health保持现有实现；frozen表示00应输出完整机器合同、01/02可据其开发但须G2，**不表示端点已运行**。planned禁止生成OpenAPI operation、任意object占位、客户端真实接线；只在登记表写责任change/待冻结字段，补充00并经两人批准后才能升级frozen。D4..D7的后续业务载荷均为候选模型，不构成已冻结操作；边界/权限仍是约束。

| 端点 | 阶段与鉴权 | 输入 | 成功输出 |
| --- | --- | --- | --- |
| GET /health | current公开 | 无body | 200原status/dependencies载荷 |
| POST /api/v1/auth/login | frozen/01公开 | username(1..64)、password(1..128)，均string必需 | 200 AuthSession+刷新Cookie |
| GET /api/v1/auth/csrf | frozen/01有效刷新Cookie | 无body | 200 {csrf_token:string(32..256)}，no-store |
| POST /api/v1/auth/refresh | frozen/01刷新Cookie+Origin+CSRF | 无body | 200 AuthSession，轮换刷新Cookie与CSRF，旧值失效；新csrf由GET重新取 |
| GET /api/v1/me | frozen/01访问令牌 | 无body | 200 Principal |
| POST /api/v1/auth/logout | frozen/01访问令牌+Cookie/Origin/CSRF | 无body | 204无body，清Cookie，撤销会话 |
| POST /api/v1/auth/switch-class | frozen/01访问令牌+Cookie/Origin/CSRF | {class_id:ID} | 200 AuthSession，新班会话/轮换Cookie，旧访问和刷新失效 |
| GET materials列表/详情、GET search | planned/04 | 完整Material/详情正文/上传下载容量未冻结 | 不输出空泛items；04先冻结Material与响应再接线 |
| POST submissions、GET task、POST task retry/cancel | planned/05 | D5是候选；05冻结请求、权限、版本和状态响应 | 禁止猜retry/cancel路径或成功体，按D5竞争语义补齐后升级 |
| PUT grade及发布/错题 | planned/08 | 输入和GradeResult候选；Grade资源成功字段/发布版本须08冻结 | 没有成功体前禁止接线或任意object |
| POST messages/cancel、GET turn | planned/07A | D6 Turn/终结事件候选 | 07A冻结全部操作/错误/查询后升级 |
| GET audits | planned/01公共审计+07/10对接 | page/page_size与教师本班约束 | Page<Audit>，action/对象枚举由相应change登记，未登记不可猜 |

AuthSession={access_token:string(1..8192),token_type:"Bearer",expires_in:900,principal:Principal}；必需且无额外字段。Principal全部字段必需，session_id为服务端32位小写十六进制随机标识，session_version正整数，expires_at对应访问令牌失效时间；资源ID/role按D2/D3。刷新Cookie max-age=604800，服务端可更早撤销，不返回令牌原值或csrf到日志；AuthSession和csrf响应Cache-Control:no-store。CSRF_TOKEN等名称仅示意字段，不是.env真实值。

所有业务Error的fields始终数组（field长度1..64，reason1..256），details始终null，只有409 TURN_EXISTS为{turn_id:ID,turn_url:string(1..512)}。code固定为D2枚举及D5/D6明确的IDEMPOTENCY_CONFLICT、RETRY_EXHAUSTED、TASK_TERMINAL、TURN_EXISTS、TURN_TERMINAL，message为1..256字符；请求ID32位小写hex。已冻结认证接口错误集合：缺失/无效身份401、CSRF/切班无资格403、非法body400、传输超限413、限流429、依赖503、超时504；me不接body，角色/班级只来自Principal。未知字段/重复键400；非本端点声明的错误码不随意新增。

候选Audit.usage精确为D6 Usage|null，无任意object；Page<T>的items元素必须显式$ref，不能用裸object。Task/Turn的error对象均限定code/message（Turn另含retryable）、必需字段；延期的Material/Grade操作不生成假Schema。00工具一致性反例覆盖null、未知属性、嵌套Usage非法、ID边界、planned误生成operation；不是仅校验示例能打开。

## Risks / Trade-offs

00采用机器可读合同以降低口头歧义；代价是小张必须验证Schema与OpenAPI的一致性。本文候选字段有明确责任归属，01等若需新增路由/字段细节必须先修订00，不得在业务实现私加公共接口。审查未发生是实际阻塞，不能由AI自审取代。

## Migration Plan

小张在00实现PR逐项修订：AGENTS骨架范围→阶段合同；backend规范→业务外层和路由登记；security→空值新增键/唯一MCP例外；testing→新BC前缀和reports；deployment→分阶段依赖与探针；product→仅02以后授权页面；两campus技能→当前变更ID而非强制PB/SC、证据reports/changes/<编号>/；foundation→按批准配置键登记检查空值而不是永久仅HTTP_PORT=。保持npm check/audit/verify入口，不删除任何原断言，依照阶段新增等价检查；make双入口由10增量落地。旧docs/lesson-07和archive只读保留，不套用其一次性免评审例外。00落地前现行规则仍有效；00落地后业务需各自批准，不能以本设计绕过现有门禁。失败回退同一组规则/合同/检查文件，不改运行数据。
