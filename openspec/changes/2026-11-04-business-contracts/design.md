## Context

基线main 2bf12e2，现有React18/Go net/http、双容器、npm门禁和v0.0.1-skeleton历史。当前/health返回status=ok、dependencies={}，生成32位十六进制X-Request-ID；没有登录、数据库或教学业务。按2026-11-04协作手册v2，00仅小葛/小张互审。本文所有业务字段是待小张审查的冻结候选，不是已运行接口；禁止复用个人旧Python仓库的实现结论。

## Goals / Non-Goals

**Goals:** 让01/02/03/10可以独立起草并清楚知道何时允许apply；00实现仅落公共契约、规则、检查和证据模板，不生成整套业务。

**Non-Goals:** 不在00实现业务端点/数据库/任务/LLM；不更改现有健康载荷；不将第7课归档例外推广成后续免评审；不代小张批准。

## Decisions

### D1 契约文件与兼容边界

小张apply后生成docs/contracts/openapi.yaml（OpenAPI3.0.3）、schemas/*.schema.json（JSON Schema2020-12）、change-dependencies.md、migration-register.md与规则对齐表。schemas至少包括Principal、Error、Page、Citation、Task、SSE、SkillInput、GradeResult、Audit；所有对象additionalProperties=false、必需字段明确，引用可解析，响应示例必须经过相同Schema验证。OpenAPI只描述未来业务合同，不注册假路由；health标为当前实现。规则版本business-contracts/v1；字段变更先改00、列受影响change，再改实现，兼容破坏使用新版本路径或双方确认迁移。

### D2 通用字段与HTTP

- 业务路径/api/v1/，资源ID为正十进制字符串，正则^[1-9][0-9]{0,18}$且数值不大于9223372036854775807；禁止JS number精度损失。version为正整数；时间UTC RFC3339毫秒，例如2026-11-04T08:00:00.000Z；金额/分数用整数百分之一分，不使用浮点。UTF-8 JSON，未知字段/重复JSON键拒绝400；JSON普通请求最大64KiB，超限413，上传例外由04明确最大字节数。
- 成功对象直接返回资源，列表返回{items:array,page:int,page_size:int,total:int}；page默认1、page_size默认20上限50；筛选/排序只接受各端点白名单，非法400，不退化成全量。排序以id作为最终唯一键；跨页稳定性承诺针对相同数据快照，并发写入不承诺offset快照隔离。
- 错误固定{error:{code:string,message:string,fields:array<{field:string,reason:string}>,details:null|{turn_id:ID,turn_url:string}},request_id:string}，request_id等于响应X-Request-ID；message不含SQL/堆栈/内部地址。资源不存在及跨班统一404/NOT_FOUND/message=资源不存在/fields=[]，除request_id外一致。
- HTTP400 VALIDATION_ERROR；401 UNAUTHENTICATED（缺失/无效/失效会话）；403 FORBIDDEN（合法身份无动作权限、CSRF失败）；404 NOT_FOUND；409 CONFLICT（版本、同键异载荷、状态/截止冲突）；413 PAYLOAD_TOO_LARGE；429 RATE_LIMITED（Retry-After整数秒）；503 DEPENDENCY_UNAVAILABLE；504 UPSTREAM_TIMEOUT。未知路径404、错误方法405（Allow头）；既有骨架非业务错误暂保持当前行为，在各API引入时统一，不倒改旧证据。
- 处理顺序：公开路由按登记；其余先认证，再动作角色，再本班/本人资源授权，再详细业务验证与副作用。未认证401优先；学生写教师功能403；同角色跨班资源404。畸形HTTP/传输超限可在认证前拒绝，需端点测试明确。拒绝无业务/文件/向量/队列写入，安全审计写入是声明的唯一例外。

### D3 Principal与会话（01实施，小张收口）

Principal={user_id:ID,role:teacher|student,class_id:ID,session_id:string,session_version:int,expires_at:timestamp}，仅来自服务端验证令牌和成员关系，不接受客户端role/class_id决定授权。教师只操作任教班，学生只操作所属班及本人会话/提交；切班须验证成员关系并签发新上下文，旧班缓存清空。01用双班四身份A教师/A学生/B教师/B学生及同班第二学生测私有归属。

公开端点候选仅GET /health、POST /api/v1/auth/login；POST /api/v1/auth/refresh与GET /api/v1/auth/csrf不要求访问令牌但必须验证刷新Cookie所对应的有效服务端会话，不是匿名放行；其他默认访问令牌保护。POST login输入{username:string(1..64),password:string(1..128)}，输出{access_token:string,expires_in:int,principal:Principal}，刷新Cookie另发；登录错误统一401不暴露用户名是否存在。GET /api/v1/me返回Principal；POST /api/v1/auth/logout返回204并撤销会话；POST /api/v1/auth/switch-class输入{class_id:ID}输出同login结构，不属于该班403且不切换。

访问令牌仅前端内存、15分钟过期；刷新令牌服务端存摘要、7天过期且轮换，Cookie HttpOnly/Secure/SameSite=Strict、Path=/api/v1/auth。refresh/logout/switch-class等Cookie参与的写操作同时检查同源Origin与X-CSRF-Token（绑定会话的随机值，GET /api/v1/auth/csrf在验证刷新会话后返回{csrf_token:string}，禁止跨源读取/宽松CORS；前端仅内存保存），失败403，不放宽生产Cookie。开发无HTTPS时只允许显式隔离开发配置，01规约须写适用范围，不自动降级。登出/改密/撤权立即使访问与刷新失效，需服务端会话版本检查；JWT本地验签不能替代撤销检查。

### D4 出处、检索和资料（04实施，小陈）

Citation={material_id:ID,chunk_id:ID,material_version:int,title:string(1..200),ordinal:int>=0,char_start:int>=0,char_end:int>start,quote:string(1..2000),url:string}，位置以规范化提取正文的Unicode码点半开区间计，正文版本不可漂移。url为受保护的站内相对地址，不是公开附件目录。读取/检索先班级过滤，再回查持久库授权和原文位置；向量payload不是权限依据。索引状态pending|indexing|ready|failed|deleted，非ready不检索；失败可显式重试，不能假报ready。

GET /api/v1/materials按Page返回材料，GET /api/v1/materials/{id}授权原文。GET /api/v1/search?q=...&mode=keyword|vector|hybrid&top_k=...，q为1..2000字符，top_k默认4、范围1..10；返回{items:Citation[],mode:enum}；无命中200空数组，跨班专属内容空，直接读跨班ID404；依赖不可达503而不是空。04细化上传/下载路由和容量前先更新契约，不把占位描述当已冻结接口。

### D5 任务、幂等与成绩（05/08实施，小张，小陈确认结果格式）

POST /api/v1/assignments/{id}/submissions输入{answer:string(1..20000),assignment_version:int}，头Idempotency-Key为16..64可打印ASCII；服务端时间>=deadline即409。成功在事务中保存submission与outbox再返回202 {submission_id:ID,task_id:ID,status:"pending"}，不等待模型。键作用域user_id+class_id+route+assignment_id，绑定规范化载荷摘要；同键同载荷返回原202且不重建任务，同键异载荷409。唯一约束和事务抵抗并发，不靠先查再写；键记录至少保留到作业归档后7天，清理策略由05受审确定，清理前无静默失效。

GET /api/v1/tasks/{task_id}返回Task={task_id,submission_id:ID,status:pending|running|succeeded|failed|cancelled,attempt:int>=0,version:int,created_at,updated_at:timestamp,error:null|{code,message}}。本人/授权本班教师可读，跨班/他人学生404。pending→running→succeeded|failed；pending→cancelled，running取消为请求标记直到worker确认，不立即伪报cancelled。失败显式重试新attempt回pending，总最多3次、指数退避1/2秒、执行租约60秒；崩溃租约到期重新投递，DB去重。终态写入必须与成绩结果提交一致；模型/消息网络不在事务内。

GradeResult={schema_version:"1",submission_id:ID,submission_version:int,rubric_version:int,skill_id:string,skill_version:string,items:[{criterion_id:ID,score:int>=0,max_score:int>=0,reason:string(1..2000),citations:Citation[]}],total_score:int>=0,max_total:int>=0}。items需与rubric分项精确对应且无重复；score<=max_score，max由rubric核验，total等于sum且<=max_total；单位为百分之一分。模型只返回建议数据，不写成绩。AI结果进入pending_review，教师以expected_version确认/改分后published；迟到AI不得覆盖人工结果。PUT /api/v1/submissions/{id}/grade输入{expected_version:int,items:[{criterion_id,score}],reason:string(1..2000)}；教师改分并发冲突409无半写入。08细化发布与错题API，在冻结前不可自行猜接口。

### D6 SSE与技能（07A/B/C顺序实施，小陈）

POST /api/v1/conversations/{id}/messages输入{client_message_id:string(16..64),content:string(1..2000)}；进入SSE前完成授权/容量/依赖检查，失败返回正常HTTP错误。相同client_message_id与内容返回既有turn当前状态（409 TURN_EXISTS，error.details={turn_id,turn_url:"/api/v1/conversations/{id}/turns/{turn_id}"}，不重复写消息）；异内容409。

text/event-stream、UTF-8、禁缓存；每帧event+data JSON，以空行结束。meta={request_id,turn_id:ID,conversation_id:ID,assistant_version:int,citations:Citation[],skill:null|{skill_id,skill_version}}恰一次在首；token={turn_id,seq:int>=1,text:string}顺序递增；done={turn_id,status:"completed",usage:{input_tokens:int>=0,output_tokens:int>=0},duration_ms:int>=0}或error={turn_id,code,message,retryable:boolean}恰一个终结，终结后无正文。未取得真实用量不能编造0，done的usage为null且usage_unavailable_reason="provider_unavailable"；有真实用量时usage为对象、usage_unavailable_reason=null，两字段均必需；注释心跳不算正文。07C新增tool事件前须补00 schema和配额，不能混入token。

取消端点POST /api/v1/conversations/{id}/turns/{turn_id}/cancel返回202请求已受理；真正取消后持久化cancelled，关闭上游连接且不发done。断网保留partial/failed，不假成功；GET /api/v1/conversations/{id}/turns/{turn_id}返回status=generating|completed|partial|failed|cancelled和已持久化文本，供重连查询，不默认重放付费调用。

SkillInput={skill_id:string,skill_version:string,principal:Principal,request_id:string,question:string,submission_id:ID|null,rubric_version:int|null,citations:Citation[]}；principal只由主机注入。技能标识guided-solving/grading/error-explanation；只从本班启用版本中选择，未授权技能/工具拒绝并审计。07B批改返回GradeResult；解题/讲解走07A文本且遵守不给最终答案/标准答案的教学规则；语义效果须真实模型评测，不用关键词匹配冒充。单轮最多4次工具、模型总60秒、资料上下文12000码点，超限受控错误。资料和工具结果是数据不升级为系统权限。

### D7 MCP、审计、配置与健康

03是独立工具服务，协议JSON-RPC2.0、POST /mcp、GET /health；initialize/tools/list/tools/call，令牌环境注入；工具question:string输入、文本输出；鉴权401。07C宿主逐次核验Principal/资源归属，模型不能决定class_id。默认拒绝SSRF私网、环回、链路本地及重定向；唯一新增候选例外http://mcp:8090/mcp，供宿主调用受控Compose MCP服务，精确匹配scheme/服务/端口/path、禁止URL用户信息/query/fragment/重定向，校验解析目标确属本项目网络服务。未获03/07C审查及部署证据前不启用；不允许通用CIDR白名单。工具超时10秒、文本<=8000字符、清单<=100工具，由03/07C具体场景验证。

Audit={audit_id:ID,request_id:string,actor_id:ID|null,class_id:ID|null,action:string,object_type:string,object_id:ID|null,result:ok|denied|error,skill_id:string|null,skill_version:string|null,usage:object|null,duration_ms:int>=0,created_at:timestamp}；匿名拒绝actor/class为null，不能信客户端班级；不记原始正文/密码/令牌。教师GET /api/v1/audits仅查本班分页，学生403；匿名或无法归班的安全记录不暴露给教师。安全审计失败时高风险变更不执行且503；普通读取可返回已授权结果并有运维告警，10补可靠持久化。

当前/health及镜像探针保持原样。引入必需依赖的change同时更新响应、探针、测试及规则：检查必需依赖down→503，不宣称未接依赖健康；LLM暂时失败不等于所有资料浏览不可用。数据库readiness失败禁止依赖它的业务流量。新增键只能空值键名，不能写HTTP_PORT=8080；配置登记含所有者、阶段、必需/可选、缺失行为与超时。00不提前扩.env.example；01登记DB/会话键，03登记MCP令牌键，07登记模型键，10部署只提供运行时值；不输出值。

### D8 阶段与文件责任

| 变更 | 起草 | apply前置 | 合并及真实验收前置 | 规约终审/实现 |
| --- | --- | --- | --- | --- |
| 00 | 最新main | 小张审当前规约并确认修改 | 小张实现合同规则，小葛终审与集成复验，真实新会话证据后归档 | 小葛/小张 |
| 01 | 可提前 | 00公共合同确认+自身规约批准 | 10门禁前置生效；双班四身份/失效真实数据库验收 | 小陈/小张 |
| 02 | 可提前 | 00确认+自身规约批准 | 局部mock测试单列；01可用后真实登录联验 | 小张/小葛 |
| 03 | 可提前 | 00确认+自身规约批准 | 10门禁；真实协议/鉴权/容器，宿主联验等07C | 小葛/小陈 |
| 04 | 00后 | 01可用+规约批准 | 授权存储和索引真实联验 | 小张/小陈 |
| 05 | 00后 | 01可用+规约批准 | outbox/worker崩溃重复恢复；假批改不等于07B通过 | 小陈/小张 |
| 06 | 接口提前 | 02可用、04/05合同确认+规约批准 | 等04/05真实接口逐项联验 | 小张/小葛 |
| 07A | 接口提前 | 01/04可用+规约批准 | 真实模型/取消/流式失败 | 小葛/小陈 |
| 07B | 可提前 | 07A终审通过+规约批准 | 固定15题含>=3拒绝反例与真实模型评测 | 小葛/小陈 |
| 07C | 可提前 | 07A/07B终审通过、03可用+规约批准 | 真实发现绑定调用、断开拒绝审计 | 小葛/小陈 |
| 08 | 格式确认后 | 05可用、GradeResult冻结+规约批准 | 07B真实闭环、人工优先/事务回滚 | 小陈/小张 |
| 09 | 可提前 | 02/06可用、AI合同明确+规约批准 | 07A/B/C/08真实接齐 | 小张/小葛 |
| 10 | 可提前 | 00确认+自身规约批准 | 前置门禁先落地；增量接线；最终服务就绪/告警/恢复分别验收 | 小葛/小陈 |
| 11 | 计划提前 | 规约批准、对应真实业务可测 | 09与各真实路径可用；小张独立复测 | 小张/小葛 |
| 12 | 计划提前 | 09/10/11通过+规约批准 | 同一候选公网/压测/三人反馈/恢复 | 小葛/小陈 |
| 13 | 证据归集 | 12通过、各真实记录齐全+规约批准 | 报告链接核对/彩排/实际课程提交另记 | 小陈/小葛 |

小葛维护frontend和前端锁；小张维护公共Go入口/身份/迁移编号；小陈维护AI/RAG/MCP、Compose/镜像/CI。共享装配走小PR，两位变更负责人检查自身迁移，不增加固定第三审批人。review绑定head SHA，关键改动需复审；归档需集成版本实测，起草完成不算apply批准。

## Risks / Trade-offs

00采用机器可读合同以降低口头歧义；代价是小张必须验证Schema与OpenAPI的一致性。本文候选字段有明确责任归属，01等若需新增路由/CSRF细节必须先修订00，不得在业务实现私加公共接口。审查未发生是实际阻塞，不能由AI自审取代。

## Migration Plan

小张在00实现PR逐项修订：AGENTS骨架范围→阶段合同；backend规范→业务外层和路由登记；security→空值新增键/唯一MCP例外；testing→新BC前缀和reports；deployment→分阶段依赖与探针；product→仅02以后授权页面；两campus技能→当前变更ID而非强制PB/SC、证据reports/changes/<编号>/；foundation→按批准配置键登记检查空值而不是永久仅HTTP_PORT=。保持npm check/audit/verify入口，不删除任何原断言，依照阶段新增等价检查；make双入口由10增量落地。旧docs/lesson-07和archive只读保留，不套用其一次性免评审例外。00落地前现行规则仍有效；00落地后业务需各自批准，不能以本设计绕过现有门禁。失败回退同一组规则/合同/检查文件，不改运行数据。
